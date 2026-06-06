import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const CASE_DIR = path.join(ROOT, "eval", "skill-cases");

async function loadCases() {
  const files = (await readdir(CASE_DIR)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => ({
    file,
    data: JSON.parse(await readFile(path.join(CASE_DIR, file), "utf8")),
  })));
}

test("skill eval dataset has balanced elastic and pro coverage", async () => {
  const cases = await loadCases();
  assert.ok(cases.length >= 12, "expected at least 12 eval cases");

  const counts = Object.groupBy(cases, ({ data }) => data.expected.skill);
  assert.ok((counts["autodl-elastic-deploy"]?.length ?? 0) >= 5);
  assert.ok((counts["autodl-instance-pro"]?.length ?? 0) >= 5);
  assert.ok((counts.none?.length ?? 0) >= 1);
});

test("each skill eval case declares measurable oracle fields", async () => {
  for (const { file, data } of await loadCases()) {
    assert.equal(typeof data.id, "string", `${file}: id`);
    assert.equal(typeof data.prompt, "string", `${file}: prompt`);
    assert.equal(typeof data.expected.skill, "string", `${file}: expected.skill`);
    assert.ok(Array.isArray(data.expected.must_include), `${file}: must_include`);
    assert.ok(Array.isArray(data.expected.must_not_include), `${file}: must_not_include`);
    assert.ok(Array.isArray(data.expected.must_not_do), `${file}: must_not_do`);
    assert.equal(typeof data.scoring.max_score, "number", `${file}: max_score`);
    assert.ok(Array.isArray(data.scoring.rubric), `${file}: rubric`);
    assert.equal(
      data.scoring.rubric.reduce((sum, item) => sum + item.points, 0),
      data.scoring.max_score,
      `${file}: rubric points sum`,
    );
  }
});

test("elastic cases require private cloud namespace and forbid Pro namespace", async () => {
  const elasticCases = (await loadCases()).filter(({ data }) => data.expected.skill === "autodl-elastic-deploy");
  for (const { file, data } of elasticCases) {
    const must = data.expected.must_include.join("\n");
    const forbidden = data.expected.must_not_include.join("\n");
    assert.match(must, /https:\/\/private\.autodl\.com|AUTODL_ELASTIC_HOST|AUTODL_ELASTIC_TOKEN|autodl-elastic\.mjs/, file);
    assert.match(forbidden, /https:\/\/api\.autodl\.com|AUTODL_PRO_HOST|AUTODL_PRO_TOKEN|autodl-pro\.mjs/, file);
    assert.ok(data.expected.must_not_do.includes("call_live_api"), `${file}: call_live_api forbidden`);
  }
});

test("pro cases require public cloud namespace and forbid Elastic namespace", async () => {
  const proCases = (await loadCases()).filter(({ data }) => data.expected.skill === "autodl-instance-pro");
  for (const { file, data } of proCases) {
    const must = data.expected.must_include.join("\n");
    const forbidden = data.expected.must_not_include.join("\n");
    assert.match(must, /https:\/\/api\.autodl\.com|AUTODL_PRO_HOST|AUTODL_PRO_TOKEN|autodl-pro\.mjs/, file);
    assert.match(forbidden, /https:\/\/private\.autodl\.com|AUTODL_ELASTIC_HOST|AUTODL_ELASTIC_TOKEN|autodl-elastic\.mjs/, file);
    assert.ok(data.expected.must_not_do.includes("call_live_api"), `${file}: call_live_api forbidden`);
  }
});
