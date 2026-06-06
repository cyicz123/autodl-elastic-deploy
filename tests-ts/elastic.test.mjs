import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { loadRuntimeContext as loadElasticRuntimeContext } from "../dist/elastic/cli.mjs";
import {
  createDeployment,
  fetchAllImages,
  fetchGpuStock,
  listBlacklists,
} from "../dist/elastic/api.mjs";
import { queueSubmit } from "../dist/elastic/queue.mjs";
import { validateElasticConfig } from "../dist/elastic/schema.mjs";
import { loadRuntimeContext as loadCoreRuntimeContext } from "../dist/core/token.mjs";

function validElasticConfig(overrides = {}) {
  return {
    name: "test-deployment",
    deployment_type: "ReplicaSet",
    replica_num: 2,
    reuse_container: true,
    container_template: {
      dc_list: ["beijing"],
      service_6006_port_protocol: "http",
      service_6008_port_protocol: "http",
      gpu_name_set: ["RTX 4090"],
      gpu_num: 1,
      cuda_v_from: 118,
      cuda_v_to: 122,
      cpu_num_from: 1,
      cpu_num_to: 4,
      memory_size_from: 4,
      memory_size_to: 16,
      cmd: "python train.py",
      price_from: 100,
      price_to: 2000,
      image_uuid: "img-12345",
    },
    ...overrides,
  };
}

async function makeSkillDir(envText = "") {
  const root = await mkdtemp(path.join(tmpdir(), "autodl-elastic-"));
  const skillDir = path.join(root, "skills", "autodl-elastic-deploy");
  await mkdir(skillDir, { recursive: true });
  if (envText) {
    await writeFile(path.join(skillDir, ".env"), envText);
  }
  return skillDir;
}

function mockFetch(responses, calls = []) {
  return async (url, init = {}) => {
    calls.push({ url, init });
    if (responses.length === 0) {
      throw new Error(`Unexpected request: ${init.method ?? "GET"} ${url}`);
    }
    const next = responses.shift();
    if (typeof next === "function") {
      return next(url, init);
    }
    return Response.json(next.body, { status: next.status ?? 200 });
  };
}

test("valid elastic config returns no validation errors", () => {
  assert.deepEqual(validateElasticConfig(validElasticConfig()), []);
});

test("deployment type specific required fields are enforced", () => {
  const replica = validElasticConfig({ deployment_type: "ReplicaSet" });
  delete replica.replica_num;
  assert.match(validateElasticConfig(replica).join("\n"), /ReplicaSet .*replica_num/);

  const job = validElasticConfig({ deployment_type: "Job" });
  delete job.replica_num;
  assert.match(validateElasticConfig(job).join("\n"), /Job .*replica_num/);

  const jobNoParallel = validElasticConfig({ deployment_type: "Job", replica_num: 2 });
  delete jobNoParallel.parallelism_num;
  assert.match(validateElasticConfig(jobNoParallel).join("\n"), /Job .*parallelism_num/);

  const container = validElasticConfig({ deployment_type: "Container" });
  delete container.replica_num;
  assert.equal(validateElasticConfig(container).some((error) => error.includes("replica_num")), false);
});

test("container_template requires elastic v2 fields", () => {
  const config = validElasticConfig();
  for (const field of [
    "dc_list",
    "gpu_name_set",
    "gpu_num",
    "cuda_v_from",
    "cuda_v_to",
    "cpu_num_from",
    "cpu_num_to",
    "memory_size_from",
    "memory_size_to",
    "price_from",
    "price_to",
    "cmd",
    "image_uuid",
  ]) {
    const copy = validElasticConfig();
    delete copy.container_template[field];
    assert.match(validateElasticConfig(copy).join("\n"), new RegExp(field));
  }
  assert.deepEqual(validateElasticConfig(config), []);
});

test("legacy cuda_v configs fail with a clear migration message", () => {
  const config = validElasticConfig();
  delete config.container_template.cuda_v_from;
  delete config.container_template.cuda_v_to;
  config.container_template.cuda_v = 118;

  assert.match(validateElasticConfig(config).join("\n"), /cuda_v_from.*cuda_v_to.*cuda_v/i);
});

test("local range and GPU validation catches obvious invalid configs", () => {
  const range = validElasticConfig();
  range.container_template.cpu_num_from = 8;
  range.container_template.cpu_num_to = 4;
  range.container_template.memory_size_from = 32;
  range.container_template.memory_size_to = 16;
  range.container_template.price_from = 3000;
  range.container_template.price_to = 1000;
  range.container_template.cuda_v_from = 122;
  range.container_template.cuda_v_to = 118;
  assert.match(validateElasticConfig(range).join("\n"), /cpu_num_from/);
  assert.match(validateElasticConfig(range).join("\n"), /memory_size_from/);
  assert.match(validateElasticConfig(range).join("\n"), /price_from/);
  assert.match(validateElasticConfig(range).join("\n"), /cuda_v_from/);

  const emptyGpu = validElasticConfig();
  emptyGpu.container_template.gpu_name_set = [];
  assert.match(validateElasticConfig(emptyGpu).join("\n"), /gpu_name_set/);

  const badGpuNum = validElasticConfig();
  badGpuNum.container_template.gpu_num = 0;
  assert.match(validateElasticConfig(badGpuNum).join("\n"), /gpu_num/);
});

test("elastic runtime uses private host and isolated env names", async () => {
  const skillDir = await makeSkillDir("AUTODL_ELASTIC_HOST=https://from-file.example\nAUTODL_ELASTIC_TOKEN=file-token");
  const context = loadElasticRuntimeContext({ skillDir, env: {} });
  assert.deepEqual(context, { host: "https://from-file.example", token: "file-token" });

  const defaultContext = loadElasticRuntimeContext({ skillDir: await makeSkillDir(), env: { AUTODL_ELASTIC_TOKEN: "token" } });
  assert.equal(defaultContext.host, "https://private.autodl.com");

  const overridden = loadElasticRuntimeContext({
    skillDir,
    env: {
      AUTODL_ELASTIC_HOST: "https://elastic-env.example",
      AUTODL_ELASTIC_TOKEN: "specific",
      AUTODL_TOKEN: "fallback",
    },
  });
  assert.deepEqual(overridden, { host: "https://elastic-env.example", token: "specific" });
});

test("AUTODL_ELASTIC_HOST does not affect Pro runtime context", async () => {
  const skillDir = await mkdtemp(path.join(tmpdir(), "autodl-pro-empty-"));
  const pro = loadCoreRuntimeContext({
    skillDir,
    defaultHost: "https://api.autodl.com",
    hostEnvName: "AUTODL_PRO_HOST",
    tokenEnvName: "AUTODL_PRO_TOKEN",
    env: {
      AUTODL_ELASTIC_HOST: "https://elastic-only.example",
      AUTODL_PRO_TOKEN: "pro-token",
    },
  });
  assert.deepEqual(pro, { host: "https://api.autodl.com", token: "pro-token" });
});

test("elastic API helpers call documented endpoints and normalize records", async () => {
  const calls = [];
  const context = {
    host: "https://private.autodl.com",
    token: "token",
    fetchImpl: mockFetch([
      {
        body: {
          code: "Success",
          data: { list: [{ image_uuid: "img-1", image_name: "named" }, { image_uuid: "img-2", name: "fallback" }], max_page: 1 },
        },
      },
      {
        body: {
          code: "Success",
          data: [{ "RTX 4090": { idle_gpu_num: 2, total_gpu_num: 8 } }],
        },
      },
      { body: { code: "Success", data: { list: [{ id: 1 }] } } },
    ], calls),
  };

  assert.deepEqual(await fetchAllImages(context), [
    { uuid: "img-1", name: "named" },
    { uuid: "img-2", name: "fallback" },
  ]);
  assert.deepEqual(await fetchGpuStock(context, { region: "beijing" }), {
    "RTX 4090": { idle: 2, total: 8 },
  });
  assert.deepEqual(await listBlacklists(context), { list: [{ id: 1 }] });

  assert.equal(calls[0].url, "https://private.autodl.com/api/v1/dev/image/private/list");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), { page_index: 1, page_size: 100 });
  assert.equal(calls[1].url, "https://private.autodl.com/api/v1/dev/machine/region/gpu_stock");
  assert.equal(calls[1].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].init.body), { region_sign: "beijing" });
});

test("createDeployment posts config to private elastic deployment endpoint", async () => {
  const calls = [];
  await createDeployment({
    host: "https://private.autodl.com",
    token: "token",
    fetchImpl: mockFetch([{ body: { code: "Success", data: { deployment_uuid: "deploy-1" } } }], calls),
  }, validElasticConfig());

  assert.equal(calls[0].url, "https://private.autodl.com/api/v1/dev/deployment");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(JSON.parse(calls[0].init.body).name, "test-deployment");
});

test("queueSubmit emits success with deployment uuid and waited seconds", async () => {
  const result = await queueSubmit(validElasticConfig(), {
    host: "https://private.autodl.com",
    token: "token",
    intervalSeconds: 0,
    timeoutSeconds: 0,
    now: (() => {
      const values = [1000, 1002];
      return () => values.shift() ?? 1002;
    })(),
    sleep: async () => {},
    fetchImpl: mockFetch([
      { body: { code: "Success", data: { list: [{ image_uuid: "img-12345", image_name: "test" }], max_page: 1 } } },
      { body: { code: "Success", data: [{ "RTX 4090": { idle_gpu_num: 4, total_gpu_num: 8 } }] } },
      { body: { code: "Success", data: { deployment_uuid: "deploy-abc" } } },
    ]),
  });

  assert.deepEqual(result, {
    status: "success",
    deployment_uuid: "deploy-abc",
    waited_seconds: 2,
  });
});

test("queueSubmit uses region GPU stock endpoint when dc_list is present", async () => {
  const calls = [];
  await queueSubmit(validElasticConfig(), {
    host: "https://private.autodl.com",
    token: "token",
    intervalSeconds: 0,
    timeoutSeconds: 0,
    sleep: async () => {},
    fetchImpl: mockFetch([
      { body: { code: "Success", data: { list: [{ image_uuid: "img-12345", image_name: "test" }], max_page: 1 } } },
      { body: { code: "Success", data: [{ "RTX 4090": { idle_gpu_num: 4, total_gpu_num: 8 } }] } },
      { body: { code: "Success", data: { deployment_uuid: "deploy-abc" } } },
    ], calls),
  });

  assert.equal(calls[1].url, "https://private.autodl.com/api/v1/dev/machine/region/gpu_stock");
  assert.deepEqual(JSON.parse(calls[1].init.body), { dc_list: ["beijing"] });
});

test("queueSubmit timeout and submission failure are structured errors", async (t) => {
  await t.test("timeout", async () => {
    await assert.rejects(
      queueSubmit(validElasticConfig(), {
        host: "https://private.autodl.com",
        token: "token",
        intervalSeconds: 0,
        timeoutSeconds: 1,
        now: (() => {
          const values = [1000, 1002];
          return () => values.shift() ?? 1002;
        })(),
        sleep: async () => {},
        fetchImpl: mockFetch([
          { body: { code: "Success", data: { list: [{ image_uuid: "img-12345", image_name: "test" }], max_page: 1 } } },
          { body: { code: "Success", data: [{ "RTX 4090": { idle_gpu_num: 0, total_gpu_num: 8 } }] } },
        ]),
      }),
      { errorType: "timeout" },
    );
  });

  await t.test("three submit failures", async () => {
    await assert.rejects(
      queueSubmit(validElasticConfig(), {
        host: "https://private.autodl.com",
        token: "token",
        intervalSeconds: 0,
        timeoutSeconds: 0,
        sleep: async () => {},
        fetchImpl: mockFetch([
          { body: { code: "Success", data: { list: [{ image_uuid: "img-12345", image_name: "test" }], max_page: 1 } } },
          { body: { code: "Success", data: [{ "RTX 4090": { idle_gpu_num: 4, total_gpu_num: 8 } }] } },
          { body: { code: "Error", msg: "temporary" } },
          { body: { code: "Success", data: [{ "RTX 4090": { idle_gpu_num: 4, total_gpu_num: 8 } }] } },
          { body: { code: "Error", msg: "temporary" } },
          { body: { code: "Success", data: [{ "RTX 4090": { idle_gpu_num: 4, total_gpu_num: 8 } }] } },
          { body: { code: "Error", msg: "temporary" } },
        ]),
      }),
      { errorType: "submission_error" },
    );
  });
});
