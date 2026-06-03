import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createInitialState,
  moveColumn,
  renameColumn,
  resizeColumn,
  setColumnType,
  setRowHeight,
  toTemplate,
  toggleColumnVisible
} from "../../public/js/state.js";
import { applyTemplateToFields, createLayout, visibleColumns } from "../../public/js/layout.js";
import {
  MAX_COLUMN_WIDTH,
  MAX_ROW_HEIGHT,
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT
} from "../../src/shared/schema.mjs";

const publicModulePaths = [
  "public/js/api.js",
  "public/js/app.js",
  "public/js/layout.js",
  "public/js/state.js",
  "public/js/schema.js"
];

const fields = [
  { id: "shot_no", name: "镜头号", type: "text" },
  { id: "voiceover", name: "旁白", type: "text" },
  { id: "reference", name: "参考", type: "image" },
  { id: "notes", name: "备注", type: "text" }
];

const template = {
  name: "均衡横版",
  paper: { size: "A4", orientation: "landscape" },
  table: { rowHeight: 96, avoidRowPageBreak: true },
  columns: [
    { fieldId: "shot_no", label: "镜头号", visible: true, width: 64 },
    { fieldId: "reference", label: "画面参考", visible: true, width: 260 },
    { fieldId: "missing", label: "不存在", visible: true, width: 100 }
  ]
};

test("applyTemplateToFields applies template columns and appends missing fields", () => {
  const columns = applyTemplateToFields(fields, template);

  assert.deepEqual(columns.map((column) => column.fieldId), ["shot_no", "reference", "voiceover", "notes"]);
  assert.equal(columns[1].label, "画面参考");
  assert.equal(columns[1].type, "image");
  assert.equal(columns[1].visible, true);
  assert.equal(columns[1].width, 260);
  assert.equal(columns[2].label, "旁白");
  assert.equal(columns[2].visible, true);
});

test("applyTemplateToFields lets templates override field render type", () => {
  const columns = applyTemplateToFields(fields, {
    ...template,
    columns: [{ fieldId: "voiceover", label: "旁白", type: "todo", visible: true, width: 180.6 }]
  });

  assert.equal(columns[0].fieldId, "voiceover");
  assert.equal(columns[0].type, "todo");
  assert.equal(columns[0].width, 181);
});

test("public modules do not import from src-relative paths", async () => {
  for (const modulePath of publicModulePaths) {
    await import(`../../${modulePath}`);
    const source = await readFile(new URL(`../../${modulePath}`, import.meta.url), "utf8");

    assert.doesNotMatch(source, /from\s+["'][^"']*src\//, `${modulePath} should only import browser-served modules`);
  }
});

test("createLayout reports missing template columns without rendering them", () => {
  const layout = createLayout(fields, template);

  assert.deepEqual(layout.columns.map((column) => column.fieldId), ["shot_no", "reference", "voiceover", "notes"]);
  assert.deepEqual(layout.missingColumns, [
    { fieldId: "missing", label: "不存在", visible: true, width: 100 }
  ]);
});

test("createLayout normalizes invalid paper settings to schema defaults", () => {
  const layout = createLayout(fields, {
    ...template,
    paper: { size: "Letter", orientation: "diagonal" }
  });

  assert.deepEqual(layout.paper, { size: "A4", orientation: "landscape" });
});

test("applyTemplateToFields clamps template widths", () => {
  const columns = applyTemplateToFields(fields, {
    ...template,
    columns: [
      { fieldId: "shot_no", label: "镜头号", visible: true, width: 1 },
      { fieldId: "reference", label: "参考", visible: true, width: 9999 }
    ]
  });

  assert.equal(columns[0].width, MIN_COLUMN_WIDTH);
  assert.equal(columns[1].width, MAX_COLUMN_WIDTH);
});

test("applyTemplateToFields falls back when template type is unsupported", () => {
  const columns = applyTemplateToFields(fields, {
    ...template,
    columns: [{ fieldId: "voiceover", label: "旁白", type: "number", visible: true, width: 180 }]
  });

  assert.equal(columns[0].type, "text");
});

test("state changes return new layout objects without mutating session data", () => {
  const session = {
    fields,
    rows: [
      {
        id: "r1",
        cells: {
          shot_no: "01",
          voiceover: "开场",
          reference: [{ path: "assets/shot.svg", caption: "图" }]
        }
      }
    ]
  };
  const originalFields = structuredClone(session.fields);
  const originalRows = structuredClone(session.rows);

  const state = createInitialState(session, template);
  const renamed = renameColumn(state, "shot_no", "镜次");
  const resized = resizeColumn(renamed, "reference", 320);
  const hidden = toggleColumnVisible(resized, "voiceover");
  const rowHeightChanged = setRowHeight(hidden, MAX_ROW_HEIGHT + 40);
  const moved = moveColumn(rowHeightChanged, "notes", 1);

  assert.equal(state.session, session);
  assert.notEqual(renamed, state);
  assert.notEqual(renamed.layout, state.layout);
  assert.notEqual(resized.layout, renamed.layout);
  assert.deepEqual(session.fields, originalFields);
  assert.deepEqual(session.rows, originalRows);
  assert.equal(moved.layout.columns.find((column) => column.fieldId === "shot_no").label, "镜次");
  assert.equal(moved.layout.columns.find((column) => column.fieldId === "reference").width, 320);
  assert.equal(visibleColumns(moved.layout).some((column) => column.fieldId === "voiceover"), false);
  assert.equal(moved.layout.table.rowHeight, MAX_ROW_HEIGHT);
  assert.deepEqual(moved.layout.columns.map((column) => column.fieldId), ["shot_no", "notes", "reference", "voiceover"]);
});

test("row height and column width changes use shared schema limits", () => {
  const state = createInitialState({ fields, rows: [] }, template);
  const narrow = resizeColumn(state, "shot_no", MIN_COLUMN_WIDTH - 10);
  const short = setRowHeight(state, MIN_ROW_HEIGHT - 10);

  assert.equal(narrow.layout.columns[0].width, MIN_COLUMN_WIDTH);
  assert.equal(short.layout.table.rowHeight, MIN_ROW_HEIGHT);
});

test("column updates and same-position moves preserve state identity when they are no-ops", () => {
  const state = createInitialState({ fields, rows: [] }, template);

  assert.equal(renameColumn(state, "absent", "缺失"), state);
  assert.equal(renameColumn(state, "shot_no", "镜头号"), state);
  assert.equal(setColumnType(state, "absent", "multiSelect"), state);
  assert.equal(setColumnType(state, "shot_no", "text"), state);
  assert.equal(resizeColumn(state, "absent", 320), state);
  assert.equal(resizeColumn(state, "shot_no", 64), state);
  assert.equal(toggleColumnVisible(state, "absent"), state);
  assert.equal(setRowHeight(state, 96), state);
  assert.equal(moveColumn(state, "absent", 1), state);
  assert.equal(moveColumn(state, "reference", 1), state);
  assert.equal(moveColumn(state, "shot_no", -10), state);
});

test("toTemplate exports layout settings without session-only data", () => {
  const state = createInitialState({ fields, rows: [] }, template);
  const updated = setColumnType(renameColumn(resizeColumn(state, "reference", 300), "reference", "分镜参考"), "notes", "multiSelect");
  const exported = toTemplate(updated.layout, "保存模板");

  assert.deepEqual(exported, {
    name: "保存模板",
    paper: { size: "A4", orientation: "landscape" },
    table: { rowHeight: 96, avoidRowPageBreak: true },
    columns: [
      { fieldId: "shot_no", label: "镜头号", type: "text", visible: true, width: 64 },
      { fieldId: "reference", label: "分镜参考", type: "image", visible: true, width: 300 },
      { fieldId: "voiceover", label: "旁白", type: "text", visible: true, width: 180 },
      { fieldId: "notes", label: "备注", type: "multiSelect", visible: true, width: 180 }
    ]
  });
});
