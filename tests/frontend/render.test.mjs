import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLayout } from "../../public/js/layout.js";
import { renderCellValue, renderPrintTable } from "../../public/js/render.js";

const fields = [
  { id: "shot_no", name: "镜头号", type: "text" },
  { id: "voiceover", name: "旁白", type: "text" },
  { id: "reference", name: "画面参考", type: "image" },
  { id: "tags", name: "标签", type: "multiSelect" },
  { id: "hidden_notes", name: "隐藏备注", type: "text" }
];

const session = {
  title: "测试脚本",
  fields,
  rows: [
    {
      id: "row_001",
      cells: {
        shot_no: "01",
        voiceover: "<script>alert('x')</script><input value='bad'><textarea>bad</textarea><div contenteditable>bad</div>",
        reference: [{ path: "assets/story board 01.svg", caption: "参考 <图>" }],
        tags: ["外景", "<重点>"],
        hidden_notes: "不应渲染"
      }
    }
  ]
};

const template = {
  name: "测试模板",
  table: { rowHeight: 123, avoidRowPageBreak: true },
  columns: [
    { fieldId: "shot_no", label: "镜头号", visible: true, width: 64 },
    { fieldId: "voiceover", label: "旁白<script>", visible: true, width: 220 },
    { fieldId: "reference", label: "参考", visible: true, width: 260 },
    { fieldId: "tags", label: "标签", visible: true, width: 120 },
    { fieldId: "hidden_notes", label: "隐藏备注", visible: false, width: 120 }
  ]
};

test("renderCellValue escapes text HTML and keeps cells read-only", () => {
  const html = renderCellValue("text", "<b>bold</b><input><textarea>x</textarea><div contenteditable>edit</div>", "sample");

  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<input\b/i);
  assert.doesNotMatch(html, /<textarea\b/i);
  assert.doesNotMatch(html, /\scontenteditable(?:\s|=|>)/i);
});

test("renderCellValue renders multi-select values as compact tags", () => {
  const html = renderCellValue("multiSelect", ["外景", "<重点>"], "sample");

  assert.match(html, /class="cell-tags"/);
  assert.match(html, /class="cell-tag">外景<\/span>/);
  assert.match(html, /class="cell-tag">&lt;重点&gt;<\/span>/);
  assert.doesNotMatch(html, /<input\b/i);
});

test("renderCellValue renders todo values with markdown-like boxes", () => {
  const html = renderCellValue("todo", "[ ] 确认场地\n[x] 准备脱敏屏幕", "sample");

  assert.match(html, /class="cell-todo-list"/);
  assert.match(html, /class="cell-todo-item"><span class="cell-todo-box"/);
  assert.match(html, /class="cell-todo-text">确认场地<\/span>/);
  assert.match(html, /class="cell-todo-item is-checked"/);
  assert.match(html, /class="cell-todo-text">准备脱敏屏幕<\/span>/);
  assert.doesNotMatch(html, /\[ \]|\[x\]/);
});

test("renderCellValue turns colored label prefixes into rounded text tags", () => {
  const html = renderCellValue("text", "🟦🟩 前台 / 工位 / 🟧 荣誉墙", "sample");

  assert.match(html, /class="cell-tags cell-tags-colored"/);
  assert.match(html, /class="cell-tag cell-tag-blue">前台<\/span>/);
  assert.match(html, /class="cell-tag cell-tag-green">工位<\/span>/);
  assert.match(html, /class="cell-tag cell-tag-orange">荣誉墙<\/span>/);
  assert.doesNotMatch(html, /🟦|🟩|🟧/u);
});

test("renderCellValue renders image asset routes with captions and contain-friendly classes", () => {
  const html = renderCellValue("image", [{ path: "assets/story board 01.svg", caption: "参考 <图>" }], "sample shoot");

  assert.match(html, /src="\/assets\/sample%20shoot\/assets%2Fstory%20board%2001\.svg"/);
  assert.match(html, /class="print-image print-image-contain"/);
  assert.match(html, /<figcaption class="print-image-caption">参考 &lt;图&gt;<\/figcaption>/);
});

test("renderPrintTable renders visible headers, row height, and omits hidden columns", () => {
  const layout = createLayout(fields, template);
  const html = renderPrintTable(session, layout, "sample-shoot");

  assert.match(html, /<table class="print-table print-table-avoid-row-break"/);
  assert.match(html, /<thead><tr>/);
  assert.match(html, /镜头号/);
  assert.match(html, /旁白&lt;script&gt;/);
  assert.match(html, /style="height: 123px;"/);
  assert.match(html, /data-field="shot_no"/);
  assert.match(html, /data-field="tags"/);
  assert.doesNotMatch(html, /隐藏备注/);
  assert.doesNotMatch(html, /不应渲染/);
});

test("renderPrintTable includes header resize handles for visible columns", () => {
  const layout = createLayout(fields, template);
  const html = renderPrintTable(session, layout, "sample-shoot");

  assert.match(html, /class="resize-handle" data-resize-field="shot_no"/);
  assert.match(html, /class="resize-handle" data-resize-field="voiceover"/);
  assert.match(html, /class="resize-handle" data-resize-field="reference"/);
  assert.match(html, /class="resize-handle" data-resize-field="tags"/);
  assert.doesNotMatch(html, /data-resize-field="hidden_notes"/);
});

test("renderPrintTable uses layout column type overrides", () => {
  const layout = createLayout(fields, {
    ...template,
    columns: [{ fieldId: "voiceover", label: "旁白", type: "multiSelect", visible: true, width: 220 }]
  });
  const html = renderPrintTable(
    {
      ...session,
      rows: [{ id: "row_001", cells: { voiceover: "口播标签" } }]
    },
    layout,
    "sample-shoot"
  );

  assert.match(html, /class="cell-tag">口播标签<\/span>/);
});

test("render module stays browser-served and read-only in source", async () => {
  const source = await readFile(new URL("../../public/js/render.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /from\s+["'][^"']*src\//);
  assert.doesNotMatch(source, /<input\b/i);
  assert.doesNotMatch(source, /<textarea\b/i);
  assert.doesNotMatch(source, /\scontenteditable(?:\s|=|>)/i);
});
