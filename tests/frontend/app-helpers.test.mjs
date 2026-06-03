import assert from "node:assert/strict";
import test from "node:test";
import {
  columnWidthValue,
  isDragContextActive,
  savedTemplateState,
  shouldApplyLoad
} from "../../public/js/app-helpers.js";

const state = {
  sessionId: "sample-shoot",
  templateId: "balanced-landscape.json",
  layout: {
    name: "均衡横版脚本表",
    columns: [
      { fieldId: "shot_no", width: 64 },
      { fieldId: "reference", width: 260 }
    ]
  }
};

test("shouldApplyLoad only allows the latest load request", () => {
  assert.equal(shouldApplyLoad(3, 3), true);
  assert.equal(shouldApplyLoad(2, 3), false);
});

test("isDragContextActive prevents stale resize drags from mutating a new selection", () => {
  assert.equal(
    isDragContextActive(state, { sessionId: "sample-shoot", templateId: "balanced-landscape.json" }),
    true
  );
  assert.equal(
    isDragContextActive(state, { sessionId: "other-session", templateId: "balanced-landscape.json" }),
    false
  );
  assert.equal(
    isDragContextActive(state, { sessionId: "sample-shoot", templateId: "other-template.json" }),
    false
  );
});

test("savedTemplateState keeps the saved template id and visible layout name together", () => {
  const next = savedTemplateState(state, { id: "new-template.json", title: "新模板" }, "Fallback");

  assert.equal(next.templateId, "new-template.json");
  assert.equal(next.layout.name, "新模板");
  assert.equal(state.templateId, "balanced-landscape.json");
  assert.equal(state.layout.name, "均衡横版脚本表");
});

test("columnWidthValue returns the layout width used for synced inputs", () => {
  assert.equal(columnWidthValue(state, "reference"), "260");
  assert.equal(columnWidthValue(state, "missing"), "");
});
