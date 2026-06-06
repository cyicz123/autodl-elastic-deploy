import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { ApiError } from "../dist/core/errors.mjs";
import { printErrorAndExit, printJson, readJsonFile } from "../dist/core/cli.mjs";
import { requestJson } from "../dist/core/http.mjs";
import { loadRuntimeContext, parseDotEnv } from "../dist/core/token.mjs";

async function makeSkillDir(name, envText = "") {
  const root = await mkdtemp(path.join(tmpdir(), "autodl-core-"));
  const skillDir = path.join(root, "skills", name);
  await mkdir(skillDir, { recursive: true });
  if (envText) {
    await writeFile(path.join(skillDir, ".env"), envText);
  }
  return skillDir;
}

test("loadRuntimeContext resolves elastic default host and skill-specific token", async () => {
  const skillDir = await makeSkillDir("autodl-elastic-deploy");

  const context = loadRuntimeContext({
    skillDir,
    defaultHost: "https://private.autodl.com",
    hostEnvName: "AUTODL_ELASTIC_HOST",
    tokenEnvName: "AUTODL_ELASTIC_TOKEN",
    env: { AUTODL_ELASTIC_TOKEN: "elastic-token" },
  });

  assert.equal(context.host, "https://private.autodl.com");
  assert.equal(context.token, "elastic-token");
});

test("loadRuntimeContext resolves pro default host and skill-specific token", async () => {
  const skillDir = await makeSkillDir("autodl-instance-pro");

  const context = loadRuntimeContext({
    skillDir,
    defaultHost: "https://api.autodl.com",
    hostEnvName: "AUTODL_PRO_HOST",
    tokenEnvName: "AUTODL_PRO_TOKEN",
    env: { AUTODL_PRO_TOKEN: "pro-token" },
  });

  assert.equal(context.host, "https://api.autodl.com");
  assert.equal(context.token, "pro-token");
});

test("host override is read from matching environment variable", async () => {
  const skillDir = await makeSkillDir("autodl-elastic-deploy");

  const context = loadRuntimeContext({
    skillDir,
    defaultHost: "https://private.autodl.com",
    hostEnvName: "AUTODL_ELASTIC_HOST",
    tokenEnvName: "AUTODL_ELASTIC_TOKEN",
    env: {
      AUTODL_ELASTIC_HOST: "https://elastic.example.test/",
      AUTODL_ELASTIC_TOKEN: "token",
    },
  });

  assert.equal(context.host, "https://elastic.example.test");
});

test("skill-specific token wins over AUTODL_TOKEN fallback", async () => {
  const skillDir = await makeSkillDir("autodl-instance-pro");

  const context = loadRuntimeContext({
    skillDir,
    defaultHost: "https://api.autodl.com",
    hostEnvName: "AUTODL_PRO_HOST",
    tokenEnvName: "AUTODL_PRO_TOKEN",
    env: {
      AUTODL_TOKEN: "compat-token",
      AUTODL_PRO_TOKEN: "specific-token",
    },
  });

  assert.equal(context.token, "specific-token");
});

test("skill-local .env files are isolated between elastic and pro", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "autodl-env-isolation-"));
  const elasticDir = path.join(root, "skills", "autodl-elastic-deploy");
  const proDir = path.join(root, "skills", "autodl-instance-pro");
  await mkdir(elasticDir, { recursive: true });
  await mkdir(proDir, { recursive: true });
  await writeFile(path.join(elasticDir, ".env"), [
    "AUTODL_ELASTIC_HOST=https://elastic.local",
    "AUTODL_ELASTIC_TOKEN=elastic-local-token",
  ].join("\n"));
  await writeFile(path.join(proDir, ".env"), [
    "AUTODL_PRO_HOST=https://pro.local",
    "AUTODL_PRO_TOKEN=pro-local-token",
  ].join("\n"));

  const elastic = loadRuntimeContext({
    skillDir: elasticDir,
    defaultHost: "https://private.autodl.com",
    hostEnvName: "AUTODL_ELASTIC_HOST",
    tokenEnvName: "AUTODL_ELASTIC_TOKEN",
    env: {},
  });
  const pro = loadRuntimeContext({
    skillDir: proDir,
    defaultHost: "https://api.autodl.com",
    hostEnvName: "AUTODL_PRO_HOST",
    tokenEnvName: "AUTODL_PRO_TOKEN",
    env: {},
  });

  assert.deepEqual(elastic, {
    host: "https://elastic.local",
    token: "elastic-local-token",
  });
  assert.deepEqual(pro, {
    host: "https://pro.local",
    token: "pro-local-token",
  });
});

test(".env parsing ignores noise and preserves values containing equals", () => {
  const parsed = parseDotEnv([
    "",
    "# comment",
    "AUTODL_ELASTIC_TOKEN=abc=def==",
    "UNKNOWN=value",
    "NO_EQUALS",
    " AUTODL_ELASTIC_HOST = https://host.example/path ",
  ].join("\n"));

  assert.equal(parsed.AUTODL_ELASTIC_TOKEN, "abc=def==");
  assert.equal(parsed.AUTODL_ELASTIC_HOST, "https://host.example/path");
  assert.equal(parsed.UNKNOWN, "value");
  assert.equal(parsed.NO_EQUALS, undefined);
});

test("requestJson sends authorization and JSON headers", async () => {
  const calls = [];
  await requestJson({
    host: "https://api.example.test",
    method: "POST",
    path: "/api/v1/dev/test",
    token: "secret-token",
    body: { ok: true },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ code: "Success", data: { value: 42 } });
    },
  });

  assert.equal(calls[0].url, "https://api.example.test/api/v1/dev/test");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "secret-token");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body), { ok: true });
});

test("requestJson returns parsed JSON when code is Success", async () => {
  const result = await requestJson({
    host: "https://api.example.test",
    method: "GET",
    path: "/ok",
    token: "token",
    fetchImpl: async () => Response.json({ code: "Success", data: { id: "abc" } }),
  });

  assert.deepEqual(result, { code: "Success", data: { id: "abc" } });
});

test("requestJson throws structured api_error for non-success outcomes", async (t) => {
  await t.test("non-2xx", async () => {
    await assert.rejects(
      requestJson({
        host: "https://api.example.test",
        method: "GET",
        path: "/missing",
        token: "token",
        fetchImpl: async () => Response.json({ msg: "not found" }, { status: 404 }),
      }),
      (error) => error instanceof ApiError && error.errorType === "api_error" && error.exitCode === 3,
    );
  });

  await t.test("invalid JSON", async () => {
    await assert.rejects(
      requestJson({
        host: "https://api.example.test",
        method: "GET",
        path: "/broken-json",
        token: "token",
        fetchImpl: async () => new Response("not json"),
      }),
      (error) => error instanceof ApiError && /Invalid JSON/.test(error.message),
    );
  });

  await t.test("fetch error", async () => {
    await assert.rejects(
      requestJson({
        host: "https://api.example.test",
        method: "GET",
        path: "/network",
        token: "token",
        fetchImpl: async () => {
          throw new Error("network down");
        },
      }),
      (error) => error instanceof ApiError && /network down/.test(error.message),
    );
  });

  await t.test("code not Success", async () => {
    await assert.rejects(
      requestJson({
        host: "https://api.example.test",
        method: "GET",
        path: "/api-error",
        token: "token",
        fetchImpl: async () => Response.json({ code: "Error", msg: "bad request", data: { id: 1 } }),
      }),
      (error) => error instanceof ApiError && error.errorType === "api_error" && error.details.code === "Error",
    );
  });
});

test("readJsonFile reads JSON and reports config errors", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "autodl-json-"));
  const jsonPath = path.join(root, "config.json");
  await writeFile(jsonPath, "{\"name\":\"ok\"}");

  assert.deepEqual(await readJsonFile(jsonPath), { name: "ok" });
  await assert.rejects(readJsonFile(path.join(root, "missing.json")), {
    errorType: "config_error",
  });
});

test("CLI printers write JSON to stdout and preserve intended exit code", () => {
  const writes = [];
  printJson({ status: "success" }, { stdout: { write: (text) => writes.push(text) } });
  assert.deepEqual(JSON.parse(writes.join("")), { status: "success" });

  const error = new ApiError("api_error", "boom", { reason: "test" }, 7);
  const exit = printErrorAndExit(error, {
    stdout: { write: (text) => writes.push(text) },
  });
  const output = JSON.parse(writes.at(-1));
  assert.equal(exit, 7);
  assert.equal(output.status, "error");
  assert.equal(output.error_type, "api_error");
  assert.equal(output.message, "boom");
  assert.deepEqual(output.details, { reason: "test" });
});
