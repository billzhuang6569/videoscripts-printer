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

test("text fields accept renderable primitives", () => {
  for (const value of ["01", 1, true, null, undefined]) {
    const session = structuredClone(validSession);
    session.rows[0].cells.shot_no = value;
    assert.deepEqual(validateSessionData(session).errors, []);
  }
});

test("text fields reject arrays and objects", () => {
  const arraySession = structuredClone(validSession);
  arraySession.rows[0].cells.shot_no = ["01"];
  const objectSession = structuredClone(validSession);
  objectSession.rows[0].cells.shot_no = { value: "01" };

  assert.match(validateSessionData(arraySession).errors[0], /第 1 行字段 shot_no.*可渲染的文本值/);
  assert.match(validateSessionData(objectSession).errors[0], /第 1 行字段 shot_no.*可渲染的文本值/);
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

test("image path safety allows safe double-dot filenames and rejects root escapes", () => {
  const session = structuredClone(validSession);
  session.rows[0].cells.reference = [{ path: "assets/shot..v2.svg" }, { path: "assets/../shot.png" }];
  assert.deepEqual(validateSessionData(session).errors, []);

  const emptyPathSession = structuredClone(validSession);
  emptyPathSession.rows[0].cells.reference = [{ path: "" }];
  assert.match(validateSessionData(emptyPathSession).errors[0], /必须是 session 内的相对路径/);

  const absolutePathSession = structuredClone(validSession);
  absolutePathSession.rows[0].cells.reference = [{ path: "/assets/shot.png" }];
  assert.match(validateSessionData(absolutePathSession).errors[0], /必须是 session 内的相对路径/);

  const escapeSession = structuredClone(validSession);
  escapeSession.rows[0].cells.reference = [{ path: "assets/../../secret.png" }];
  assert.match(validateSessionData(escapeSession).errors[0], /必须是 session 内的相对路径/);

  const windowsAbsoluteSession = structuredClone(validSession);
  windowsAbsoluteSession.rows[0].cells.reference = [{ path: "C:\\secret.png" }];
  assert.match(validateSessionData(windowsAbsoluteSession).errors[0], /必须是 session 内的相对路径/);

  const windowsTraversalSession = structuredClone(validSession);
  windowsTraversalSession.rows[0].cells.reference = [{ path: "assets\\..\\secret.png" }];
  assert.match(validateSessionData(windowsTraversalSession).errors[0], /必须是 session 内的相对路径/);
});

test("image field only allows browser-displayable extensions", () => {
  const session = structuredClone(validSession);
  session.rows[0].cells.reference = [{ path: "assets/shot.gif" }];
  assert.match(validateSessionData(session).errors[0], /可显示的图片扩展名/);
});

test("image validation can use custom extensions and existence context", () => {
  const session = structuredClone(validSession);
  session.rows[0].cells.reference = [{ path: "assets/shot.gif" }, { path: "assets/missing.gif" }];

  const errors = validateSessionData(session, {
    allowedImageExtensions: [".gif"],
    imageExists: (imagePath) => imagePath !== "assets/missing.gif"
  }).errors.join("\n");

  assert.match(errors, /第 1 行字段 reference 的第 2 张图片不存在：assets\/missing.gif/);
  assert.doesNotMatch(errors, /可显示的图片扩展名/);
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

test("template reports missing field references when field ids are provided", () => {
  const template = structuredClone(validTemplate);
  template.columns.push({ fieldId: "missing", label: "缺失", visible: true, width: 80 });

  assert.deepEqual(validateTemplate(template).errors, []);
  assert.match(validateTemplate(template, { fieldIds: ["shot_no"] }).errors[0], /第 2 列引用了 fields 中不存在的字段：missing/);
});
