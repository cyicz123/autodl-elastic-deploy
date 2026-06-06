import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");

async function readSkill(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

function assertIncludesAll(text, snippets) {
  const missing = snippets.filter((snippet) => !text.includes(snippet));
  assert.deepEqual(missing, []);
}

test("elastic skill teaches complete dry-run responses and CUDA integer codes", async () => {
  const skill = await readSkill("skills/autodl-elastic-deploy/SKILL.md");
  const examples = await readSkill("skills/autodl-elastic-deploy/examples.md");
  const combined = `${skill}\n${examples}`;

  assertIncludesAll(combined, [
    "dry-run",
    "no live API call",
    "not executed",
    "https://private.autodl.com",
    "AUTODL_ELASTIC_TOKEN",
    "/api/v1/dev/deployment/container/list",
    "/api/v1/dev/machine/region/gpu_stock",
    "/api/v1/dev/deployment",
    "`cuda_v_from` / `cuda_v_to` are integer codes",
    "not semantic version strings",
    "do not write `\"11.8\"`, `\"12.1\"`, or `\"12.8\"`",
    "\"name\": \"inference-service\"",
    "\"cuda_v_from\": 118",
    "\"cuda_v_to\": 122",
    "after 3 submit failures",
    "不要直接重试",
  ]);
});

test("pro skill teaches complete dry-run responses and Pro payload details", async () => {
  const skill = await readSkill("skills/autodl-instance-pro/SKILL.md");
  const examples = await readSkill("skills/autodl-instance-pro/examples.md");
  const combined = `${skill}\n${examples}`;

  assertIncludesAll(combined, [
    "dry-run",
    "no live API call",
    "not executed",
    "https://api.autodl.com",
    "AUTODL_PRO_TOKEN",
    "node <SKILL_DIR>/autodl-pro.mjs create --json <config.json>",
    "validation_error",
    "/api/v1/dev/instance/pro/power_on",
    "\"instance_uuid\": \"pro-xxxxxxxx\"",
    "\"payload\": \"gpu\"",
    "\"start_command\": \"bash /root/start.sh\"",
    "/api/v1/dev/instance/pro/image/save",
    "\"image_name\": \"my-saved-image\"",
  ]);
});
