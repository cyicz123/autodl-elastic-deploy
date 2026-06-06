import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createInstance,
  getSnapshot,
  getStatus,
  listImages,
  listInstances,
  powerOff,
  powerOn,
  releaseInstance,
  saveImage,
} from "../dist/pro/api.mjs";
import { loadRuntimeContext as loadElasticRuntimeContext } from "../dist/elastic/cli.mjs";
import { loadRuntimeContext as loadProRuntimeContext } from "../dist/pro/cli.mjs";
import { validateCreateConfig } from "../dist/pro/schema.mjs";

function validProConfig(overrides = {}) {
  return {
    req_gpu_amount: 1,
    expand_system_disk_by_gb: 50,
    gpu_spec_uuid: "GPU-RTX4090",
    image_uuid: "image-abc",
    cuda_v_from: 118,
    ...overrides,
  };
}

async function makeSkillDir(name, envText = "") {
  const root = await mkdtemp(path.join(tmpdir(), "autodl-pro-"));
  const skillDir = path.join(root, "skills", name);
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
    return Response.json(next.body, { status: next.status ?? 200 });
  };
}

test("create request validates required Pro fields", () => {
  assert.deepEqual(validateCreateConfig(validProConfig()), []);
  for (const field of ["req_gpu_amount", "expand_system_disk_by_gb", "gpu_spec_uuid", "image_uuid", "cuda_v_from"]) {
    const config = validProConfig();
    delete config[field];
    assert.match(validateCreateConfig(config).join("\n"), new RegExp(field));
  }
});

test("Pro numeric validation enforces documented ranges", () => {
  assert.match(validateCreateConfig(validProConfig({ req_gpu_amount: 0 })).join("\n"), /req_gpu_amount/);
  assert.match(validateCreateConfig(validProConfig({ req_gpu_amount: 5 })).join("\n"), /req_gpu_amount/);
  assert.match(validateCreateConfig(validProConfig({ expand_system_disk_by_gb: -1 })).join("\n"), /expand_system_disk_by_gb/);
  assert.match(validateCreateConfig(validProConfig({ expand_system_disk_by_gb: 501 })).join("\n"), /expand_system_disk_by_gb/);
});

test("Pro runtime uses public host and isolated env names", async () => {
  const skillDir = await makeSkillDir("autodl-instance-pro", "AUTODL_PRO_HOST=https://pro-file.example\nAUTODL_PRO_TOKEN=file-token");
  assert.deepEqual(loadProRuntimeContext({ skillDir, env: {} }), {
    host: "https://pro-file.example",
    token: "file-token",
  });

  const defaultContext = loadProRuntimeContext({ skillDir: await makeSkillDir("autodl-instance-pro"), env: { AUTODL_PRO_TOKEN: "token" } });
  assert.deepEqual(defaultContext, { host: "https://api.autodl.com", token: "token" });

  const overridden = loadProRuntimeContext({
    skillDir,
    env: {
      AUTODL_PRO_HOST: "https://pro-env.example",
      AUTODL_PRO_TOKEN: "specific",
      AUTODL_TOKEN: "fallback",
    },
  });
  assert.deepEqual(overridden, { host: "https://pro-env.example", token: "specific" });
});

test("AUTODL_PRO_HOST does not affect elastic runtime context", async () => {
  const skillDir = await makeSkillDir("autodl-elastic-deploy");
  const elastic = loadElasticRuntimeContext({
    skillDir,
    env: {
      AUTODL_PRO_HOST: "https://pro-only.example",
      AUTODL_ELASTIC_TOKEN: "elastic-token",
    },
  });
  assert.deepEqual(elastic, { host: "https://private.autodl.com", token: "elastic-token" });
});

test("Pro API helpers call documented endpoints", async () => {
  const calls = [];
  const context = {
    host: "https://api.autodl.com",
    token: "token",
    fetchImpl: mockFetch([
      { body: { code: "Success", data: { instance_uuid: "pro-1" } } },
      { body: { code: "Success", data: { snapshot: "ok" } } },
      { body: { code: "Success", data: { status: "running" } } },
      { body: { code: "Success", data: { list: [] } } },
      { body: { code: "Success", data: null } },
      { body: { code: "Success", data: null } },
      { body: { code: "Success", data: null } },
      { body: { code: "Success", data: { image_uuid: "img-save" } } },
      { body: { code: "Success", data: { list: [] } } },
    ], calls),
  };

  await createInstance(context, validProConfig());
  await getSnapshot(context, "pro-abc123");
  await getStatus(context, "pro-abc123");
  await listInstances(context, 1, 10);
  await powerOn(context, "pro-abc123", "bash start.sh");
  await powerOff(context, "pro-abc123");
  await releaseInstance(context, "pro-abc123");
  await saveImage(context, "pro-abc123", "saved-image");
  await listImages(context, 2, 20);

  assert.deepEqual(calls.map((call) => [call.init.method, new URL(call.url).pathname]), [
    ["POST", "/api/v1/dev/instance/pro/create"],
    ["GET", "/api/v1/dev/instance/pro/snapshot"],
    ["GET", "/api/v1/dev/instance/pro/status"],
    ["POST", "/api/v1/dev/instance/pro/list"],
    ["POST", "/api/v1/dev/instance/pro/power_on"],
    ["POST", "/api/v1/dev/instance/pro/power_off"],
    ["POST", "/api/v1/dev/instance/pro/release"],
    ["POST", "/api/v1/dev/instance/pro/image/save"],
    ["POST", "/api/v1/dev/instance/pro/image/private/list"],
  ]);

  assert.deepEqual(JSON.parse(calls[0].init.body), validProConfig());
  assert.deepEqual(JSON.parse(calls[1].init.body), { instance_uuid: "pro-abc123" });
  assert.deepEqual(JSON.parse(calls[2].init.body), { instance_uuid: "pro-abc123" });
  assert.deepEqual(JSON.parse(calls[3].init.body), { page_index: 1, page_size: 10 });
  assert.deepEqual(JSON.parse(calls[4].init.body), {
    instance_uuid: "pro-abc123",
    payload: "gpu",
    start_command: "bash start.sh",
  });
  assert.deepEqual(JSON.parse(calls[6].init.body), { instance_uuid: "pro-abc123" });
  assert.deepEqual(JSON.parse(calls[7].init.body), {
    instance_uuid: "pro-abc123",
    image_name: "saved-image",
  });
  assert.deepEqual(JSON.parse(calls[8].init.body), { page_index: 2, page_size: 20 });
});

test("power-on omits start_command when not provided", async () => {
  const calls = [];
  await powerOn({
    host: "https://api.autodl.com",
    token: "token",
    fetchImpl: mockFetch([{ body: { code: "Success", data: null } }], calls),
  }, "pro-abc123");

  assert.deepEqual(JSON.parse(calls[0].init.body), {
    instance_uuid: "pro-abc123",
    payload: "gpu",
  });
});

test("release does not silently power off first", async () => {
  const calls = [];
  await releaseInstance({
    host: "https://api.autodl.com",
    token: "token",
    fetchImpl: mockFetch([{ body: { code: "Success", data: null } }], calls),
  }, "pro-abc123");

  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname, "/api/v1/dev/instance/pro/release");
});
