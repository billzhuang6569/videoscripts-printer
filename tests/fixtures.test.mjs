import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  FIELD_TYPES,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  PAPER_ORIENTATIONS,
  PAPER_SIZES
} from "../src/shared/schema.mjs";

const SAMPLE_FILE = "imports/sample-shoot/data.json";
const TEMPLATE_FILES = [
  "templates/shot-script/balanced-landscape.json",
  "templates/shot-script/storyboard-heavy.json",
  "templates/shot-script/narration-heavy.json"
];

async function readJson(file) {
  const parsed = JSON.parse(await readFile(file, "utf8"));
  assert.equal(typeof parsed, "object", `${file} should parse to an object`);
  assert.notEqual(parsed, null, `${file} should parse to a non-null object`);
  return parsed;
}

function isSafeRelativePath(value) {
  return typeof value === "string" && value.length > 0 && !value.startsWith("/") && !value.includes("..");
}

test("sample session follows shared schema invariants", async () => {
  const sample = await readJson(SAMPLE_FILE);
  const fieldIds = new Set();

  assert.ok(Array.isArray(sample.fields), "sample fields should be an array");
  assert.ok(Array.isArray(sample.rows), "sample rows should be an array");

  for (const field of sample.fields) {
    assert.equal(typeof field.id, "string", "field id should be a string");
    assert.equal(fieldIds.has(field.id), false, `field id should be unique: ${field.id}`);
    fieldIds.add(field.id);
    assert.ok(FIELD_TYPES.includes(field.type), `field type should be supported: ${field.type}`);
  }

  for (const row of sample.rows) {
    assert.equal(typeof row.id, "string", "row id should be a string");
    assert.equal(typeof row.cells, "object", `${row.id} should have cells`);
    assert.notEqual(row.cells, null, `${row.id} cells should be non-null`);

    for (const [fieldId, value] of Object.entries(row.cells)) {
      assert.ok(fieldIds.has(fieldId), `${row.id} should only use declared field ids`);
      const field = sample.fields.find((candidate) => candidate.id === fieldId);

      if (field.type === "image") {
        assert.ok(Array.isArray(value), `${row.id}.${fieldId} should be an image array`);

        for (const image of value) {
          assert.ok(isSafeRelativePath(image.path), `${row.id}.${fieldId} image path should be safe relative`);
          await access(`imports/sample-shoot/${image.path}`);
        }
      }
    }
  }
});

test("default templates follow shared schema invariants and sample fields", async () => {
  const sample = await readJson(SAMPLE_FILE);
  const fieldIds = new Set(sample.fields.map((field) => field.id));

  for (const file of TEMPLATE_FILES) {
    const template = await readJson(file);
    const templateFieldIds = new Set();

    assert.ok(PAPER_SIZES.includes(template.paper?.size), `${file} should use a supported paper size`);
    assert.ok(PAPER_ORIENTATIONS.includes(template.paper?.orientation), `${file} should use a supported orientation`);
    assert.ok(Array.isArray(template.columns), `${file} columns should be an array`);

    for (const column of template.columns) {
      assert.ok(fieldIds.has(column.fieldId), `${file} column fieldId should exist in sample data: ${column.fieldId}`);
      assert.equal(templateFieldIds.has(column.fieldId), false, `${file} should not duplicate column fieldId: ${column.fieldId}`);
      templateFieldIds.add(column.fieldId);
      assert.ok(
        Number.isFinite(column.width) && column.width >= MIN_COLUMN_WIDTH && column.width <= MAX_COLUMN_WIDTH,
        `${file} column width should be between ${MIN_COLUMN_WIDTH} and ${MAX_COLUMN_WIDTH}: ${column.fieldId}`
      );
    }
  }
});
