import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = () => readFile(new URL("../../public/js/app.js", import.meta.url), "utf8");

test("app shell labels visibility checkboxes with field names", async () => {
  const source = await appSource();

  assert.match(source, /aria-label="显示字段：\$\{escapeAttr\(visibilityLabel\)\}"/);
  assert.match(source, /const visibilityLabel = column\.label \|\| field\?\.name \|\| column\.fieldId/);
});

test("app shell guards async selection loads against stale renders", async () => {
  const source = await appSource();

  assert.match(source, /let loadSequence = 0/);
  assert.match(source, /const requestId = \+\+loadSequence/);
  assert.match(source, /if \(requestId !== loadSequence\) return/);
  assert.match(source, /currentSessionId = sessionId/);
  assert.match(source, /currentTemplateId = templateId/);
});

test("app shell renders asset routes with the loaded session id", async () => {
  const source = await appSource();

  assert.match(source, /state = withLoadedSelection\(createInitialState\(session, template\), sessionId, templateId\)/);
  assert.match(source, /const sessionId = state\.sessionId \?\? currentSessionId/);
  assert.match(source, /renderPrintTable\(state\.session, state\.layout, sessionId\)/);
});

test("app shell wires preview resize handles to layout width controls", async () => {
  const source = await appSource();

  assert.match(source, /addEventListener\("pointerdown", handleResizePointerDown\)/);
  assert.match(source, /event\.target\.closest\("\[data-resize-field\]"\)/);
  assert.match(source, /state = resizeColumn\(state, fieldId, startingWidth \+ moveEvent\.clientX - startX\)/);
  assert.match(source, /syncColumnWidthControl\(fieldId\)/);
  assert.match(source, /renderFieldControls\(\)/);
});

test("template save keeps the saved template id and name in current state", async () => {
  const source = await appSource();

  assert.match(source, /currentTemplateId = saved\.id/);
  assert.match(source, /templateId: saved\.id/);
  assert.match(source, /name: saved\.title \|\| trimmedName/);
});
