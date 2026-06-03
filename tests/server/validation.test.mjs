import assert from "node:assert/strict";
import test from "node:test";
import { validateSessionData, validateTemplate } from "../../src/server/validation.mjs";

const validSession = {
  title: "脚本",
  fields: [
    { id: "shot_no", name: "镜头号", type: "text" },
    { id: "tags", name: "标签", type: "multiSelect" },
    { id: "reference", name: "参考", type: "image" }
  ],
  rows: [
    {
      id: "row_001",
      cells: {
        shot_no: "01",
        tags: ["重点"],
        reference: [{ path: "assets/shot.svg", caption: "图" }]
      }
    }
  ]
};

const validTemplate = {
  name: "均衡横版",
  paper: { size: "A4", orientation: "landscape" },
  table: { rowHeight: 96, avoidRowPageBreak: true },
  columns: [{ fieldId: "shot_no", label: "镜头号", visible: true, width: 64 }]
};

test("valid session passes", () => {
  assert.deepEqual(validateSessionData(validSession).errors, []);
});

test("duplicate field ids fail", () => {
  const session = structuredClone(validSession);
  session.fields.push({ id: "shot_no", name: "重复", type: "text" });
  assert.match(validateSessionData(session).errors[0], /字段 id 重复/);
});

test("unsupported field type fails", () => {
  const session = structuredClone(validSession);
  session.fields[0].type = "number";
  assert.match(validateSessionData(session).errors[0], /不支持的字段类型/);
});

test("unknown row cell field fails", () => {
  const session = structuredClone(validSession);
  session.rows[0].cells.extra = "x";
  assert.match(validateSessionData(session).errors[0], /未定义/);
});

test("multiSelect must be string array", () => {
  const session = structuredClone(validSession);
  session.rows[0].cells.tags = "重点";
  assert.match(validateSessionData(session).errors[0], /必须是字符串数组/);
});

test("image field must be image array", () => {
  const session = structuredClone(validSession);
  session.rows[0].cells.reference = { path: "assets/shot.svg" };
  assert.match(validateSessionData(session).errors[0], /必须是图片数组/);
});

test("image field must use safe relative paths", () => {
  const session = structuredClone(validSession);
  session.rows[0].cells.reference = [{ path: "../secret.png" }];
  assert.match(validateSessionData(session).errors[0], /必须是 session 内的相对路径/);
});

test("valid template passes", () => {
  assert.deepEqual(validateTemplate(validTemplate).errors, []);
});

test("template supports portrait A4", () => {
  const template = structuredClone(validTemplate);
  template.paper.orientation = "portrait";
  assert.deepEqual(validateTemplate(template).errors, []);
});

test("template reports bad orientation and duplicate columns", () => {
  const template = structuredClone(validTemplate);
  template.name = "坏模板";
  template.paper.orientation = "diagonal";
  template.columns.push({ fieldId: "shot_no", label: "重复", visible: true, width: 80 });

  const errors = validateTemplate(template).errors.join("\n");
  assert.match(errors, /纸张方向/);
  assert.match(errors, /重复引用字段/);
});

test("template row height must be within bounds", () => {
  const template = structuredClone(validTemplate);
  template.table.rowHeight = 999;
  assert.match(validateTemplate(template).errors[0], /行高必须在/);
});

test("template column width must be within bounds", () => {
  const template = structuredClone(validTemplate);
  template.columns[0].width = 24;
  assert.match(validateTemplate(template).errors[0], /列宽度必须在/);
});
