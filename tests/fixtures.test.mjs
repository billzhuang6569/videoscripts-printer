import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sample session and default templates are parseable JSON", async () => {
  const files = [
    "imports/sample-shoot/data.json",
    "templates/shot-script/balanced-landscape.json",
    "templates/shot-script/storyboard-heavy.json",
    "templates/shot-script/narration-heavy.json"
  ];

  for (const file of files) {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    assert.equal(typeof parsed, "object", `${file} should parse to an object`);
  }
});
