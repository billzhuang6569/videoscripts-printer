import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("print CSS repeats table headers and footers for paged output", async () => {
  const source = await readFile(new URL("../../public/styles/print.css", import.meta.url), "utf8");

  assert.match(source, /\.print-table\s+thead\s*\{[^}]*display:\s*table-header-group;/s);
  assert.match(source, /\.print-table\s+tfoot\s*\{[^}]*display:\s*table-footer-group;/s);
});
