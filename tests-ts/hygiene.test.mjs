import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHECK_PATHS = ["README.md", "skills", "tests-ts", "src"];
const STALE_TERMS = [
  ["queue", "_submit", ".", "py"].join(""),
  ["py", "test"].join(""),
  ["requirements", "-dev", ".", "txt"].join(""),
  ["pyproject", ".", "toml"].join(""),
];

async function* walk(target) {
  const info = await stat(target);
  if (info.isDirectory()) {
    for (const entry of await readdir(target)) {
      yield* walk(path.join(target, entry));
    }
    return;
  }
  yield target;
}

test("active instructions do not reference retired Python implementation", async () => {
  const staleMatches = [];
  for (const checkPath of CHECK_PATHS) {
    for await (const filePath of walk(path.join(ROOT, checkPath))) {
      if (filePath.endsWith("hygiene.test.mjs")) {
        continue;
      }
      if (!/\.(md|mjs|mts|json|example|txt)$/.test(filePath)) {
        continue;
      }
      const text = await readFile(filePath, "utf8");
      if (STALE_TERMS.some((term) => text.includes(term))) {
        staleMatches.push(path.relative(ROOT, filePath));
      }
    }
  }

  assert.deepEqual(staleMatches, []);
});
