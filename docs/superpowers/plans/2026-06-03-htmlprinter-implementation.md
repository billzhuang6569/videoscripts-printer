# HTMLprinter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app that loads structured shooting-script print sessions, applies shared templates, previews A4 pages, and prints or saves to PDF without allowing content edits.

**Architecture:** Use a lightweight Node.js local service to read session folders, serve local image assets, validate data, and save shared templates. Use a dependency-light browser frontend with focused JavaScript modules for state, rendering, column sizing, and print controls. Keep imported data immutable in the UI; only template/layout state changes.

**Tech Stack:** Node.js built-in `http`, `fs`, `path`, and `node:test`; vanilla HTML/CSS/JavaScript; browser-native print dialog and CSS print styles.

---

All paths below are relative to `/Users/billzhuang/Documents/AI Workspace/codex/HTMLprinter`.

## File Structure

- Create `package.json`: scripts for start, test, and fixture validation.
- Create `.gitignore`: exclude dependencies, runtime cache, and temporary brainstorm files.
- Create `src/server/validation.mjs`: pure validation functions for sessions and templates.
- Create `src/server/repository.mjs`: filesystem-safe loading and saving for sessions, assets, and templates.
- Create `src/server/server.mjs`: local HTTP API and static frontend server.
- Create `src/server/mime.mjs`: MIME lookup for static files and image assets.
- Create `src/shared/schema.mjs`: shared constants for field types, paper settings, and default limits.
- Create `public/index.html`: app shell.
- Create `public/styles/app.css`: screen UI and paper preview styles.
- Create `public/styles/print.css`: print-only CSS.
- Create `public/js/api.js`: frontend API client.
- Create `public/js/state.js`: immutable app state transitions.
- Create `public/js/layout.js`: template application, column order, column widths, and row-height logic.
- Create `public/js/render.js`: read-only table and cell rendering.
- Create `public/js/app.js`: browser wiring for controls and events.
- Create `imports/sample-shoot/data.json`: sample print session.
- Create `imports/sample-shoot/assets/`: sample SVG image assets.
- Create `templates/shot-script/*.json`: three shared default templates.
- Create `tests/server/*.test.mjs`: Node unit and API tests.
- Create `tests/frontend/*.test.mjs`: pure frontend module tests.

## Task 1: Project Baseline And Fixtures

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `src/shared/schema.mjs`
- Create: `imports/sample-shoot/data.json`
- Create: `imports/sample-shoot/assets/shot-001-ref.svg`
- Create: `imports/sample-shoot/assets/shot-002-ref.svg`
- Create: `templates/shot-script/balanced-landscape.json`
- Create: `templates/shot-script/storyboard-heavy.json`
- Create: `templates/shot-script/narration-heavy.json`
- Create: `tests/fixtures.test.mjs`

- [ ] **Step 1: Initialize git if the directory is still not a repository**

Run:

```bash
git rev-parse --is-inside-work-tree || git init
```

Expected: either `true` or a new Git repository initialized in the project root.

- [ ] **Step 2: Write the fixture test first**

Create `tests/fixtures.test.mjs`:

```js
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run:

```bash
node --test tests/fixtures.test.mjs
```

Expected: FAIL because fixture files do not exist yet.

- [ ] **Step 4: Create project metadata**

Create `package.json`:

```json
{
  "name": "htmlprinter",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"tests/**/*.test.mjs\""
  }
}
```

Create `.gitignore`:

```gitignore
node_modules/
.DS_Store
.superpowers/
coverage/
```

- [ ] **Step 5: Create shared schema constants**

Create `src/shared/schema.mjs`:

```js
export const FIELD_TYPES = Object.freeze(["text", "multiSelect", "image"]);
export const PAPER_SIZES = Object.freeze(["A4"]);
export const PAPER_ORIENTATIONS = Object.freeze(["landscape", "portrait"]);

export const DEFAULT_ROW_HEIGHT = 96;
export const MIN_ROW_HEIGHT = 56;
export const MAX_ROW_HEIGHT = 260;
export const MIN_COLUMN_WIDTH = 48;
export const MAX_COLUMN_WIDTH = 720;
```

- [ ] **Step 6: Create sample session and assets**

Create `imports/sample-shoot/data.json`:

```json
{
  "title": "样例拍摄脚本表",
  "source": {
    "type": "manual-sample",
    "name": "sample-shoot",
    "generatedAt": "2026-06-03T10:00:00+08:00"
  },
  "fields": [
    { "id": "shot_no", "name": "镜头号", "type": "text" },
    { "id": "voiceover", "name": "旁白", "type": "text" },
    { "id": "visual", "name": "画面内容", "type": "text" },
    { "id": "reference", "name": "画面参考/分镜", "type": "image" },
    { "id": "notes", "name": "备注", "type": "text" },
    { "id": "tags", "name": "标签", "type": "multiSelect" }
  ],
  "rows": [
    {
      "id": "row_001",
      "cells": {
        "shot_no": "01",
        "voiceover": "开场介绍项目背景，语速稳定。",
        "visual": "人物从画面左侧入场，镜头缓慢推进到中近景。",
        "reference": [{ "path": "assets/shot-001-ref.svg", "caption": "开场构图参考" }],
        "notes": "注意现场环境声。",
        "tags": ["外景", "重点"]
      }
    },
    {
      "id": "row_002",
      "cells": {
        "shot_no": "02",
        "voiceover": "解释核心流程，强调关键节点。",
        "visual": "切到手部操作特写，再回到人物表情。",
        "reference": [{ "path": "assets/shot-002-ref.svg", "caption": "操作特写参考" }],
        "notes": "补拍一条干净空镜。",
        "tags": ["特写", "补拍"]
      }
    }
  ]
}
```

Create `imports/sample-shoot/assets/shot-001-ref.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#ece7dc"/>
  <rect x="58" y="48" width="524" height="264" rx="10" fill="#d6c8ad"/>
  <circle cx="238" cy="164" r="52" fill="#f6f1e8"/>
  <rect x="320" y="128" width="172" height="92" rx="8" fill="#8d948a"/>
  <text x="320" y="312" text-anchor="middle" font-family="Arial" font-size="26" fill="#37352f">Shot 01 Reference</text>
</svg>
```

Create `imports/sample-shoot/assets/shot-002-ref.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#e8eef2"/>
  <rect x="88" y="74" width="464" height="212" rx="12" fill="#b8c5ce"/>
  <rect x="186" y="122" width="268" height="116" rx="10" fill="#ffffff"/>
  <circle cx="250" cy="180" r="34" fill="#6f8792"/>
  <rect x="308" y="154" width="96" height="52" rx="6" fill="#cad6dc"/>
  <text x="320" y="316" text-anchor="middle" font-family="Arial" font-size="26" fill="#2f3b42">Shot 02 Reference</text>
</svg>
```

- [ ] **Step 7: Create default templates**

Create `templates/shot-script/balanced-landscape.json`:

```json
{
  "name": "均衡横版脚本表",
  "paper": { "size": "A4", "orientation": "landscape" },
  "table": { "rowHeight": 96, "density": "normal", "avoidRowPageBreak": true },
  "columns": [
    { "fieldId": "shot_no", "label": "镜头号", "visible": true, "width": 64 },
    { "fieldId": "voiceover", "label": "旁白", "visible": true, "width": 220 },
    { "fieldId": "visual", "label": "画面内容", "visible": true, "width": 260 },
    { "fieldId": "reference", "label": "画面参考/分镜", "visible": true, "width": 260 },
    { "fieldId": "notes", "label": "备注", "visible": true, "width": 150 },
    { "fieldId": "tags", "label": "标签", "visible": true, "width": 120 }
  ]
}
```

Create `templates/shot-script/storyboard-heavy.json`:

```json
{
  "name": "分镜图优先",
  "paper": { "size": "A4", "orientation": "landscape" },
  "table": { "rowHeight": 128, "density": "normal", "avoidRowPageBreak": true },
  "columns": [
    { "fieldId": "shot_no", "label": "镜头号", "visible": true, "width": 60 },
    { "fieldId": "voiceover", "label": "旁白", "visible": true, "width": 180 },
    { "fieldId": "visual", "label": "画面内容", "visible": true, "width": 210 },
    { "fieldId": "reference", "label": "画面参考/分镜", "visible": true, "width": 380 },
    { "fieldId": "tags", "label": "标签", "visible": true, "width": 110 }
  ]
}
```

Create `templates/shot-script/narration-heavy.json`:

```json
{
  "name": "文本优先",
  "paper": { "size": "A4", "orientation": "landscape" },
  "table": { "rowHeight": 104, "density": "normal", "avoidRowPageBreak": true },
  "columns": [
    { "fieldId": "shot_no", "label": "镜头号", "visible": true, "width": 60 },
    { "fieldId": "voiceover", "label": "旁白", "visible": true, "width": 310 },
    { "fieldId": "visual", "label": "画面内容", "visible": true, "width": 310 },
    { "fieldId": "reference", "label": "画面参考/分镜", "visible": true, "width": 180 },
    { "fieldId": "notes", "label": "备注", "visible": true, "width": 130 }
  ]
}
```

- [ ] **Step 8: Run fixture test**

Run:

```bash
npm test -- tests/fixtures.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add package.json .gitignore src/shared/schema.mjs imports templates tests/fixtures.test.mjs
git commit -m "chore: add htmlprinter baseline fixtures"
```

Expected: commit succeeds.

## Task 2: Session And Template Validation

**Files:**
- Create: `src/server/validation.mjs`
- Create: `tests/server/validation.test.mjs`

- [ ] **Step 1: Write validation tests**

Create `tests/server/validation.test.mjs`:

```js
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

test("image field must use safe relative paths", () => {
  const session = structuredClone(validSession);
  session.rows[0].cells.reference = [{ path: "../secret.png" }];
  assert.match(validateSessionData(session).errors[0], /必须是 session 内的相对路径/);
});

test("valid template passes", () => {
  const template = {
    name: "均衡横版",
    paper: { size: "A4", orientation: "landscape" },
    table: { rowHeight: 96, avoidRowPageBreak: true },
    columns: [{ fieldId: "shot_no", label: "镜头号", visible: true, width: 64 }]
  };
  assert.deepEqual(validateTemplate(template).errors, []);
});

test("template reports bad orientation and duplicate columns", () => {
  const template = {
    name: "坏模板",
    paper: { size: "A4", orientation: "diagonal" },
    table: { rowHeight: 96, avoidRowPageBreak: true },
    columns: [
      { fieldId: "shot_no", label: "镜头号", visible: true, width: 64 },
      { fieldId: "shot_no", label: "重复", visible: true, width: 80 }
    ]
  };
  const errors = validateTemplate(template).errors.join("\n");
  assert.match(errors, /纸张方向/);
  assert.match(errors, /重复引用字段/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test tests/server/validation.test.mjs
```

Expected: FAIL because `src/server/validation.mjs` does not exist.

- [ ] **Step 3: Implement validation module**

Create `src/server/validation.mjs`:

```js
import {
  FIELD_TYPES,
  MAX_COLUMN_WIDTH,
  MAX_ROW_HEIGHT,
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT,
  PAPER_ORIENTATIONS,
  PAPER_SIZES
} from "../shared/schema.mjs";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeRelativePath(value) {
  return typeof value === "string" && value.length > 0 && !value.startsWith("/") && !value.includes("..");
}

export function validateSessionData(data) {
  const errors = [];

  if (!isPlainObject(data)) {
    return { errors: ["data.json 必须是对象"] };
  }

  if (!Array.isArray(data.fields)) errors.push("fields 必须是数组");
  if (!Array.isArray(data.rows)) errors.push("rows 必须是数组");
  if (errors.length > 0) return { errors };

  const fieldIds = new Set();
  const fieldTypes = new Map();

  data.fields.forEach((field, index) => {
    if (!isPlainObject(field)) {
      errors.push(`第 ${index + 1} 个字段必须是对象`);
      return;
    }
    if (typeof field.id !== "string" || field.id.length === 0) errors.push(`第 ${index + 1} 个字段缺少 id`);
    if (fieldIds.has(field.id)) errors.push(`字段 id 重复：${field.id}`);
    fieldIds.add(field.id);
    if (typeof field.name !== "string" || field.name.length === 0) errors.push(`字段 ${field.id} 缺少 name`);
    if (!FIELD_TYPES.includes(field.type)) errors.push(`字段 ${field.id} 使用了不支持的字段类型：${field.type}`);
    fieldTypes.set(field.id, field.type);
  });

  data.rows.forEach((row, rowIndex) => {
    if (!isPlainObject(row)) {
      errors.push(`第 ${rowIndex + 1} 行必须是对象`);
      return;
    }
    if (!isPlainObject(row.cells)) {
      errors.push(`第 ${rowIndex + 1} 行缺少 cells 对象`);
      return;
    }

    Object.entries(row.cells).forEach(([fieldId, value]) => {
      const type = fieldTypes.get(fieldId);
      if (!type) {
        errors.push(`第 ${rowIndex + 1} 行引用了 fields 中未定义的字段：${fieldId}`);
        return;
      }
      if (type === "multiSelect" && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) {
        errors.push(`第 ${rowIndex + 1} 行字段 ${fieldId} 必须是字符串数组`);
      }
      if (type === "image") {
        if (!Array.isArray(value)) {
          errors.push(`第 ${rowIndex + 1} 行字段 ${fieldId} 必须是图片数组`);
          return;
        }
        value.forEach((image, imageIndex) => {
          if (!isPlainObject(image) || !isSafeRelativePath(image.path)) {
            errors.push(`第 ${rowIndex + 1} 行字段 ${fieldId} 的第 ${imageIndex + 1} 张图片路径必须是 session 内的相对路径`);
          }
        });
      }
    });
  });

  return { errors };
}

export function validateTemplate(template) {
  const errors = [];

  if (!isPlainObject(template)) return { errors: ["模板必须是对象"] };
  if (typeof template.name !== "string" || template.name.length === 0) errors.push("模板缺少 name");
  if (!isPlainObject(template.paper)) errors.push("模板缺少 paper 对象");
  if (!isPlainObject(template.table)) errors.push("模板缺少 table 对象");
  if (!Array.isArray(template.columns)) errors.push("模板 columns 必须是数组");
  if (errors.length > 0) return { errors };

  if (!PAPER_SIZES.includes(template.paper.size)) errors.push(`不支持的纸张尺寸：${template.paper.size}`);
  if (!PAPER_ORIENTATIONS.includes(template.paper.orientation)) errors.push(`不支持的纸张方向：${template.paper.orientation}`);
  if (!Number.isFinite(template.table.rowHeight) || template.table.rowHeight < MIN_ROW_HEIGHT || template.table.rowHeight > MAX_ROW_HEIGHT) {
    errors.push(`行高必须在 ${MIN_ROW_HEIGHT} 到 ${MAX_ROW_HEIGHT} 之间`);
  }

  const seen = new Set();
  template.columns.forEach((column, index) => {
    if (!isPlainObject(column)) {
      errors.push(`第 ${index + 1} 列必须是对象`);
      return;
    }
    if (typeof column.fieldId !== "string" || column.fieldId.length === 0) errors.push(`第 ${index + 1} 列缺少 fieldId`);
    if (seen.has(column.fieldId)) errors.push(`模板重复引用字段：${column.fieldId}`);
    seen.add(column.fieldId);
    if (typeof column.label !== "string" || column.label.length === 0) errors.push(`第 ${index + 1} 列缺少 label`);
    if (typeof column.visible !== "boolean") errors.push(`第 ${index + 1} 列 visible 必须是布尔值`);
    if (!Number.isFinite(column.width) || column.width < MIN_COLUMN_WIDTH || column.width > MAX_COLUMN_WIDTH) {
      errors.push(`第 ${index + 1} 列宽度必须在 ${MIN_COLUMN_WIDTH} 到 ${MAX_COLUMN_WIDTH} 之间`);
    }
  });

  return { errors };
}
```

- [ ] **Step 4: Run validation tests**

Run:

```bash
node --test tests/server/validation.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/server/validation.mjs tests/server/validation.test.mjs
git commit -m "feat: validate print sessions and templates"
```

Expected: commit succeeds.

## Task 3: Filesystem Repository

**Files:**
- Create: `src/server/repository.mjs`
- Create: `tests/server/repository.test.mjs`

- [ ] **Step 1: Write repository tests**

Create `tests/server/repository.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createRepository,
  safeTemplateFileName,
  sessionAssetPath
} from "../../src/server/repository.mjs";

test("lists sessions and loads a session data file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "htmlprinter-"));
  await mkdir(path.join(root, "imports", "sample", "assets"), { recursive: true });
  await writeFile(path.join(root, "imports", "sample", "data.json"), JSON.stringify({ fields: [], rows: [] }));

  const repo = createRepository(root);
  assert.deepEqual(await repo.listSessions(), [{ id: "sample", title: "sample" }]);
  assert.deepEqual(await repo.loadSession("sample"), { fields: [], rows: [] });
});

test("template save uses safe generated filenames", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "htmlprinter-"));
  const repo = createRepository(root);
  const saved = await repo.saveTemplate({
    name: "均衡 横版 / v1",
    paper: { size: "A4", orientation: "landscape" },
    table: { rowHeight: 96, avoidRowPageBreak: true },
    columns: []
  });

  assert.equal(saved.id, "balanced-v1.json");
  const text = await readFile(path.join(root, "templates", "shot-script", saved.id), "utf8");
  assert.match(text, /均衡 横版/);
});

test("asset paths cannot escape session folder", () => {
  assert.throws(() => sessionAssetPath("/root", "sample", "../secret.png"), /非法图片路径/);
});

test("template filename sanitizer is stable", () => {
  assert.equal(safeTemplateFileName("Storyboard Heavy"), "storyboard-heavy.json");
  assert.equal(safeTemplateFileName("均衡 横版 / v1"), "balanced-v1.json");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test tests/server/repository.test.mjs
```

Expected: FAIL because `src/server/repository.mjs` does not exist.

- [ ] **Step 3: Implement repository**

Create `src/server/repository.mjs`:

```js
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TEMPLATE_DIR = path.join("templates", "shot-script");

const NAME_ALIASES = new Map([
  ["均衡 横版 / v1", "balanced-v1"],
  ["均衡横版脚本表", "balanced-landscape"],
  ["分镜图优先", "storyboard-heavy"],
  ["文本优先", "narration-heavy"]
]);

export function safeTemplateFileName(name) {
  const alias = NAME_ALIASES.get(name);
  const raw = alias ?? name;
  const slug = raw
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return `${slug || "template"}.json`;
}

export function ensureInside(basePath, candidatePath, message) {
  const resolvedBase = path.resolve(basePath);
  const resolvedCandidate = path.resolve(candidatePath);
  if (resolvedCandidate !== resolvedBase && !resolvedCandidate.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error(message);
  }
  return resolvedCandidate;
}

export function sessionAssetPath(rootDir, sessionId, assetPath) {
  if (path.isAbsolute(assetPath) || assetPath.includes("..")) {
    throw new Error("非法图片路径");
  }
  const sessionDir = path.join(rootDir, "imports", sessionId);
  return ensureInside(sessionDir, path.join(sessionDir, assetPath), "非法图片路径");
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function createRepository(rootDir) {
  const importsDir = path.join(rootDir, "imports");
  const templatesDir = path.join(rootDir, TEMPLATE_DIR);

  return {
    async listSessions() {
      if (!(await exists(importsDir))) return [];
      const entries = await readdir(importsDir, { withFileTypes: true });
      const sessions = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dataPath = path.join(importsDir, entry.name, "data.json");
        if (await exists(dataPath)) sessions.push({ id: entry.name, title: entry.name });
      }
      return sessions.sort((a, b) => a.id.localeCompare(b.id));
    },

    async loadSession(sessionId) {
      const filePath = ensureInside(importsDir, path.join(importsDir, sessionId, "data.json"), "非法 session 路径");
      return JSON.parse(await readFile(filePath, "utf8"));
    },

    async listTemplates() {
      if (!(await exists(templatesDir))) return [];
      const entries = await readdir(templatesDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => ({ id: entry.name, title: entry.name.replace(/\.json$/, "") }))
        .sort((a, b) => a.id.localeCompare(b.id));
    },

    async loadTemplate(templateId) {
      const filePath = ensureInside(templatesDir, path.join(templatesDir, templateId), "非法模板路径");
      return JSON.parse(await readFile(filePath, "utf8"));
    },

    async saveTemplate(template) {
      await mkdir(templatesDir, { recursive: true });
      const id = safeTemplateFileName(template.name);
      const filePath = ensureInside(templatesDir, path.join(templatesDir, id), "非法模板路径");
      await writeFile(filePath, `${JSON.stringify(template, null, 2)}\n`);
      return { id, title: template.name };
    },

    resolveAsset(sessionId, assetPath) {
      return sessionAssetPath(rootDir, sessionId, assetPath);
    }
  };
}
```

- [ ] **Step 4: Run repository tests**

Run:

```bash
node --test tests/server/repository.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/server/repository.mjs tests/server/repository.test.mjs
git commit -m "feat: add local session repository"
```

Expected: commit succeeds.

## Task 4: Local HTTP Service

**Files:**
- Modify: `package.json`
- Create: `src/server/mime.mjs`
- Create: `src/server/server.mjs`
- Create: `tests/server/server.test.mjs`

- [ ] **Step 1: Write server API tests**

Create `tests/server/server.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createAppServer } from "../../src/server/server.mjs";

async function fixtureRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "htmlprinter-server-"));
  await mkdir(path.join(root, "imports", "sample", "assets"), { recursive: true });
  await mkdir(path.join(root, "templates", "shot-script"), { recursive: true });
  await writeFile(path.join(root, "imports", "sample", "data.json"), JSON.stringify({
    fields: [{ id: "shot_no", name: "镜头号", type: "text" }],
    rows: [{ id: "r1", cells: { shot_no: "01" } }]
  }));
  await writeFile(path.join(root, "templates", "shot-script", "balanced-landscape.json"), JSON.stringify({
    name: "均衡横版",
    paper: { size: "A4", orientation: "landscape" },
    table: { rowHeight: 96, avoidRowPageBreak: true },
    columns: [{ fieldId: "shot_no", label: "镜头号", visible: true, width: 64 }]
  }));
  await writeFile(path.join(root, "imports", "sample", "assets", "shot.svg"), "<svg/>");
  return root;
}

test("server lists sessions and templates", async () => {
  const server = createAppServer({ rootDir: await fixtureRoot(), publicDir: "public" });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const sessions = await fetch(`${base}/api/sessions`).then((res) => res.json());
  const templates = await fetch(`${base}/api/templates`).then((res) => res.json());

  assert.equal(sessions[0].id, "sample");
  assert.equal(templates[0].id, "balanced-landscape.json");
  server.close();
});

test("server loads validated session and rejects missing session", async () => {
  const server = createAppServer({ rootDir: await fixtureRoot(), publicDir: "public" });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const ok = await fetch(`${base}/api/sessions/sample`).then((res) => res.json());
  const missing = await fetch(`${base}/api/sessions/missing`);

  assert.equal(ok.rows[0].cells.shot_no, "01");
  assert.equal(missing.status, 404);
  server.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test tests/server/server.test.mjs
```

Expected: FAIL because `src/server/server.mjs` does not exist.

- [ ] **Step 3: Implement MIME helper**

Create `src/server/mime.mjs`:

```js
const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"]
]);

export function mimeTypeFor(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES.get(ext) ?? "application/octet-stream";
}
```

- [ ] **Step 4: Add start script**

Modify `package.json`:

```json
{
  "name": "htmlprinter",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server/server.mjs",
    "test": "node --test \"tests/**/*.test.mjs\""
  }
}
```

- [ ] **Step 5: Implement HTTP server**

Create `src/server/server.mjs`:

```js
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mimeTypeFor } from "./mime.mjs";
import { createRepository, ensureInside } from "./repository.mjs";
import { validateSessionData, validateTemplate } from "./validation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_PUBLIC = path.join(DEFAULT_ROOT, "public");

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function sendFile(res, filePath) {
  const data = await readFile(filePath);
  res.writeHead(200, { "content-type": mimeTypeFor(filePath) });
  res.end(data);
}

export function createAppServer({ rootDir = DEFAULT_ROOT, publicDir = DEFAULT_PUBLIC } = {}) {
  const repo = createRepository(rootDir);

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");

      if (req.method === "GET" && url.pathname === "/api/sessions") {
        return sendJson(res, 200, await repo.listSessions());
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/sessions/")) {
        const sessionId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
        const data = await repo.loadSession(sessionId);
        const result = validateSessionData(data);
        if (result.errors.length > 0) return sendJson(res, 422, { errors: result.errors });
        return sendJson(res, 200, data);
      }

      if (req.method === "GET" && url.pathname === "/api/templates") {
        return sendJson(res, 200, await repo.listTemplates());
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/templates/")) {
        const templateId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
        const template = await repo.loadTemplate(templateId);
        const result = validateTemplate(template);
        if (result.errors.length > 0) return sendJson(res, 422, { errors: result.errors });
        return sendJson(res, 200, template);
      }

      if (req.method === "POST" && url.pathname === "/api/templates") {
        const template = await readJsonBody(req);
        const result = validateTemplate(template);
        if (result.errors.length > 0) return sendJson(res, 422, { errors: result.errors });
        return sendJson(res, 201, await repo.saveTemplate(template));
      }

      if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
        const [, , sessionId, ...assetParts] = url.pathname.split("/");
        return sendFile(res, repo.resolveAsset(decodeURIComponent(sessionId), decodeURIComponent(assetParts.join("/"))));
      }

      const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
      const staticPath = ensureInside(publicDir, path.join(publicDir, decodeURIComponent(requestPath)), "非法静态文件路径");
      return sendFile(res, staticPath);
    } catch (error) {
      const status = error.code === "ENOENT" ? 404 : 500;
      return sendJson(res, status, { errors: [error.message] });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createAppServer().listen(port, () => {
    console.log(`HTMLprinter running at http://localhost:${port}`);
  });
}
```

- [ ] **Step 6: Run server tests**

Run:

```bash
node --test tests/server/server.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add package.json src/server/mime.mjs src/server/server.mjs tests/server/server.test.mjs
git commit -m "feat: serve sessions templates and assets"
```

Expected: commit succeeds.

## Task 5: Frontend State And Layout Modules

**Files:**
- Create: `public/js/state.js`
- Create: `public/js/layout.js`
- Create: `tests/frontend/state-layout.test.mjs`

- [ ] **Step 1: Write frontend state tests**

Create `tests/frontend/state-layout.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, renameColumn, resizeColumn, toggleColumnVisible } from "../../public/js/state.js";
import { applyTemplateToFields, visibleColumns } from "../../public/js/layout.js";

const fields = [
  { id: "shot_no", name: "镜头号", type: "text" },
  { id: "voiceover", name: "旁白", type: "text" },
  { id: "reference", name: "参考", type: "image" }
];

const template = {
  name: "均衡横版",
  paper: { size: "A4", orientation: "landscape" },
  table: { rowHeight: 96, avoidRowPageBreak: true },
  columns: [
    { fieldId: "shot_no", label: "镜头号", visible: true, width: 64 },
    { fieldId: "reference", label: "画面参考", visible: true, width: 260 }
  ]
};

test("applyTemplateToFields appends fields missing from template", () => {
  const columns = applyTemplateToFields(fields, template);
  assert.deepEqual(columns.map((column) => column.fieldId), ["shot_no", "reference", "voiceover"]);
  assert.equal(columns[2].label, "旁白");
});

test("state changes layout but keeps session data object unchanged", () => {
  const session = { fields, rows: [{ id: "r1", cells: { shot_no: "01" } }] };
  const state = createInitialState(session, template);
  const renamed = renameColumn(state, "shot_no", "镜次");
  const resized = resizeColumn(renamed, "reference", 320);
  const hidden = toggleColumnVisible(resized, "voiceover");

  assert.equal(session.fields[0].name, "镜头号");
  assert.equal(hidden.layout.columns.find((column) => column.fieldId === "shot_no").label, "镜次");
  assert.equal(hidden.layout.columns.find((column) => column.fieldId === "reference").width, 320);
  assert.equal(visibleColumns(hidden.layout).some((column) => column.fieldId === "voiceover"), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test tests/frontend/state-layout.test.mjs
```

Expected: FAIL because frontend modules do not exist.

- [ ] **Step 3: Implement layout module**

Create `public/js/layout.js`:

```js
import { DEFAULT_ROW_HEIGHT, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from "../../src/shared/schema.mjs";

export function clampColumnWidth(width) {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Number(width) || MIN_COLUMN_WIDTH));
}

export function applyTemplateToFields(fields, template) {
  const byFieldId = new Map(fields.map((field) => [field.id, field]));
  const used = new Set();
  const columns = [];

  for (const column of template.columns ?? []) {
    const field = byFieldId.get(column.fieldId);
    if (!field) continue;
    used.add(field.id);
    columns.push({
      fieldId: field.id,
      type: field.type,
      label: column.label || field.name,
      visible: column.visible !== false,
      width: clampColumnWidth(column.width)
    });
  }

  for (const field of fields) {
    if (used.has(field.id)) continue;
    columns.push({
      fieldId: field.id,
      type: field.type,
      label: field.name,
      visible: true,
      width: field.type === "image" ? 260 : 180
    });
  }

  return columns;
}

export function createLayout(fields, template) {
  return {
    name: template.name,
    paper: template.paper ?? { size: "A4", orientation: "landscape" },
    table: {
      rowHeight: template.table?.rowHeight ?? DEFAULT_ROW_HEIGHT,
      avoidRowPageBreak: template.table?.avoidRowPageBreak !== false
    },
    columns: applyTemplateToFields(fields, template)
  };
}

export function visibleColumns(layout) {
  return layout.columns.filter((column) => column.visible);
}
```

- [ ] **Step 4: Implement state module**

Create `public/js/state.js`:

```js
import { createLayout, clampColumnWidth } from "./layout.js";
import { MAX_ROW_HEIGHT, MIN_ROW_HEIGHT } from "../../src/shared/schema.mjs";

function cloneLayout(layout) {
  return {
    ...layout,
    paper: { ...layout.paper },
    table: { ...layout.table },
    columns: layout.columns.map((column) => ({ ...column }))
  };
}

export function createInitialState(session, template) {
  return {
    session,
    layout: createLayout(session.fields, template),
    selectedRowId: null
  };
}

export function renameColumn(state, fieldId, label) {
  const layout = cloneLayout(state.layout);
  const column = layout.columns.find((item) => item.fieldId === fieldId);
  if (column) column.label = label;
  return { ...state, layout };
}

export function resizeColumn(state, fieldId, width) {
  const layout = cloneLayout(state.layout);
  const column = layout.columns.find((item) => item.fieldId === fieldId);
  if (column) column.width = clampColumnWidth(width);
  return { ...state, layout };
}

export function toggleColumnVisible(state, fieldId) {
  const layout = cloneLayout(state.layout);
  const column = layout.columns.find((item) => item.fieldId === fieldId);
  if (column) column.visible = !column.visible;
  return { ...state, layout };
}

export function setRowHeight(state, rowHeight) {
  const next = Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, Number(rowHeight) || MIN_ROW_HEIGHT));
  const layout = cloneLayout(state.layout);
  layout.table.rowHeight = next;
  return { ...state, layout };
}

export function toTemplate(layout, name) {
  return {
    name,
    paper: { ...layout.paper },
    table: { ...layout.table },
    columns: layout.columns.map(({ fieldId, label, visible, width }) => ({ fieldId, label, visible, width }))
  };
}
```

- [ ] **Step 5: Run frontend state tests**

Run:

```bash
node --test tests/frontend/state-layout.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add public/js/state.js public/js/layout.js tests/frontend/state-layout.test.mjs
git commit -m "feat: add immutable layout state"
```

Expected: commit succeeds.

## Task 6: Read-Only Renderer

**Files:**
- Create: `public/js/render.js`
- Create: `tests/frontend/render.test.mjs`

- [ ] **Step 1: Write renderer tests**

Create `tests/frontend/render.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { renderCellValue, renderPrintTable } from "../../public/js/render.js";

test("text rendering escapes HTML and does not create inputs", () => {
  const html = renderCellValue("text", "<script>alert(1)</script>");
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<input|contenteditable|textarea/);
});

test("multiSelect renders compact tag pills", () => {
  const html = renderCellValue("multiSelect", ["外景", "重点"]);
  assert.match(html, /class="tag"/);
  assert.match(html, /外景/);
});

test("image rendering uses session asset route and contain-friendly markup", () => {
  const html = renderCellValue("image", [{ path: "assets/shot.svg", caption: "参考" }], "sample");
  assert.match(html, /src="\/assets\/sample\/assets%2Fshot.svg"/);
  assert.match(html, /参考/);
});

test("table rendering includes headers and fixed row height style", () => {
  const session = {
    title: "样例",
    rows: [{ id: "r1", cells: { shot_no: "01" } }]
  };
  const layout = {
    table: { rowHeight: 96 },
    columns: [{ fieldId: "shot_no", type: "text", label: "镜头号", visible: true, width: 64 }]
  };
  const html = renderPrintTable(session, layout, "sample");
  assert.match(html, /镜头号/);
  assert.match(html, /height:96px/);
  assert.doesNotMatch(html, /contenteditable|textarea|<input/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test tests/frontend/render.test.mjs
```

Expected: FAIL because `public/js/render.js` does not exist.

- [ ] **Step 3: Implement renderer**

Create `public/js/render.js`:

```js
import { visibleColumns } from "./layout.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderCellValue(type, value, sessionId = "") {
  if (type === "multiSelect") {
    const tags = Array.isArray(value) ? value : [];
    return `<div class="tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
  }

  if (type === "image") {
    const images = Array.isArray(value) ? value : [];
    return `<div class="image-list">${images.map((image) => {
      const src = `/assets/${encodeURIComponent(sessionId)}/${encodeURIComponent(image.path)}`;
      const caption = image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : "";
      return `<figure class="image-attachment"><img src="${src}" alt="${escapeHtml(image.caption || "参考图")}" loading="lazy">${caption}</figure>`;
    }).join("")}</div>`;
  }

  return `<div class="text-cell">${escapeHtml(value)}</div>`;
}

export function renderPrintTable(session, layout, sessionId) {
  const columns = visibleColumns(layout);
  const gridTemplate = columns.map((column) => `${column.width}px`).join(" ");
  const header = columns.map((column) => `<th style="width:${column.width}px">${escapeHtml(column.label)}</th>`).join("");
  const rows = session.rows.map((row) => {
    const cells = columns.map((column) => {
      const value = row.cells?.[column.fieldId];
      return `<td>${renderCellValue(column.type, value, sessionId)}</td>`;
    }).join("");
    return `<tr data-row-id="${escapeHtml(row.id)}" style="height:${layout.table.rowHeight}px">${cells}</tr>`;
  }).join("");

  return `
    <section class="paper-table-wrap" style="--grid-template:${gridTemplate}">
      <table class="print-table">
        <thead><tr>${header}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}
```

- [ ] **Step 4: Run renderer tests**

Run:

```bash
node --test tests/frontend/render.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add public/js/render.js tests/frontend/render.test.mjs
git commit -m "feat: render read only print table"
```

Expected: commit succeeds.

## Task 7: App Shell And Browser Wiring

**Files:**
- Create: `public/index.html`
- Create: `public/js/api.js`
- Create: `public/js/app.js`
- Create: `public/styles/app.css`
- Create: `public/styles/print.css`
- Create or modify: `tests/frontend/*.test.mjs` for app-shell source sanity, resize wiring, accessible visibility labels, stale-load guards, and print CSS header/footer repetition checks.

- [ ] **Step 1: Create API client**

Create `public/js/api.js`:

```js
async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error((body.errors ?? [`请求失败：${response.status}`]).join("\n"));
  }
  return body;
}

export const api = {
  listSessions: () => requestJson("/api/sessions"),
  loadSession: (sessionId) => requestJson(`/api/sessions/${encodeURIComponent(sessionId)}`),
  listTemplates: () => requestJson("/api/templates"),
  loadTemplate: (templateId) => requestJson(`/api/templates/${encodeURIComponent(templateId)}`),
  saveTemplate: (template) => requestJson("/api/templates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(template)
  })
};
```

- [ ] **Step 2: Create app HTML shell**

Create `public/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>HTMLprinter</title>
    <link rel="stylesheet" href="/styles/app.css">
    <link rel="stylesheet" href="/styles/print.css" media="print">
  </head>
  <body>
    <header class="toolbar">
      <div class="brand">
        <strong>HTMLprinter</strong>
        <span id="sessionTitle">未加载 session</span>
      </div>
      <label>Session <select id="sessionSelect"></select></label>
      <label>Template <select id="templateSelect"></select></label>
      <button id="orientationButton" type="button">横向</button>
      <button id="saveTemplateButton" type="button">保存模板</button>
      <button id="printButton" type="button">打印</button>
    </header>

    <main class="app-shell">
      <aside class="settings-panel">
        <section>
          <h2>字段</h2>
          <div id="fieldList" class="field-list"></div>
        </section>
        <section>
          <h2>行高</h2>
          <input id="rowHeightInput" type="range" min="56" max="260" step="4">
          <output id="rowHeightValue"></output>
        </section>
        <section>
          <h2>提示</h2>
          <p class="hint">这里只调整打印版式，不编辑脚本内容。</p>
        </section>
      </aside>

      <section class="preview-stage">
        <div id="errorBox" class="error-box" hidden></div>
        <article id="paper" class="paper landscape">
          <div class="empty-state">请选择 session 和模板</div>
        </article>
      </section>
    </main>

    <script type="module" src="/js/app.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Create screen styles**

Create `public/styles/app.css`:

```css
:root {
  color-scheme: light;
  --ink: #252525;
  --muted: #6c6c6c;
  --line: #d7d7d7;
  --panel: #f5f5f2;
  --paper: #fffefb;
  --accent: #2f6f73;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--ink);
  background: #e9e9e4;
}
button, select, input { font: inherit; }
.toolbar {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid var(--line);
}
.brand {
  display: flex;
  flex-direction: column;
  min-width: 180px;
}
.brand span { color: var(--muted); font-size: 12px; }
.toolbar button, .toolbar select {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 6px;
  min-height: 32px;
  padding: 0 10px;
}
#printButton {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}
.app-shell {
  display: grid;
  grid-template-columns: 300px 1fr;
  min-height: calc(100vh - 56px);
}
.settings-panel {
  background: var(--panel);
  border-right: 1px solid var(--line);
  padding: 16px;
  overflow: auto;
}
.settings-panel h2 {
  margin: 0 0 10px;
  font-size: 14px;
}
.field-list {
  display: grid;
  gap: 8px;
}
.field-item {
  display: grid;
  grid-template-columns: 24px 1fr 58px;
  gap: 8px;
  align-items: center;
  padding: 8px;
  background: white;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.field-item input[type="text"] {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 4px 6px;
}
.field-type {
  color: var(--muted);
  font-size: 12px;
}
.preview-stage {
  padding: 24px;
  overflow: auto;
}
.paper {
  width: 1123px;
  min-height: 794px;
  margin: 0 auto 24px;
  padding: 28px;
  background: var(--paper);
  box-shadow: 0 12px 36px rgba(0,0,0,.18);
}
.paper.portrait {
  width: 794px;
  min-height: 1123px;
}
.paper-title {
  margin: 0 0 14px;
  font-size: 20px;
}
.print-table {
  border-collapse: collapse;
  width: max-content;
  min-width: 100%;
  table-layout: fixed;
}
.print-table th,
.print-table td {
  border: 1px solid #9d9d9d;
  padding: 6px;
  vertical-align: top;
  overflow: hidden;
}
.print-table th {
  background: #eeeeea;
  font-weight: 700;
}
.print-table tr {
  break-inside: avoid;
  page-break-inside: avoid;
}
.text-cell {
  white-space: pre-wrap;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tag {
  border: 1px solid #b9c7c8;
  background: #eef7f6;
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 12px;
}
.image-list {
  display: grid;
  gap: 6px;
}
.image-attachment {
  margin: 0;
}
.image-attachment img {
  display: block;
  width: 100%;
  max-height: calc(var(--row-height, 96px) - 26px);
  object-fit: contain;
}
.image-attachment figcaption {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
}
.error-box {
  margin: 0 auto 16px;
  max-width: 1123px;
  padding: 10px 12px;
  border: 1px solid #d28c8c;
  background: #fff1f1;
  color: #7a2020;
  border-radius: 6px;
  white-space: pre-wrap;
}
.empty-state {
  display: grid;
  min-height: 360px;
  place-items: center;
  color: var(--muted);
}
.hint { color: var(--muted); }
```

- [ ] **Step 4: Create print styles**

Create `public/styles/print.css`:

```css
@page {
  size: A4 landscape;
  margin: 10mm;
}

body {
  background: white;
}

.toolbar,
.settings-panel,
.error-box {
  display: none !important;
}

.app-shell,
.preview-stage {
  display: block;
  padding: 0;
  min-height: 0;
  overflow: visible;
}

.paper {
  width: auto !important;
  min-height: 0 !important;
  margin: 0;
  padding: 0;
  box-shadow: none;
  background: white;
}

.paper.portrait {
  width: auto !important;
}

.print-table {
  width: 100%;
  page-break-inside: auto;
}

.print-table thead {
  display: table-header-group;
}

.print-table tr {
  break-inside: avoid;
  page-break-inside: avoid;
}
```

- [ ] **Step 5: Wire browser app**

Create `public/js/app.js`:

```js
import { api } from "./api.js";
import { createInitialState, renameColumn, setRowHeight, toTemplate, toggleColumnVisible } from "./state.js";
import { renderPrintTable } from "./render.js";

const elements = {
  sessionTitle: document.querySelector("#sessionTitle"),
  sessionSelect: document.querySelector("#sessionSelect"),
  templateSelect: document.querySelector("#templateSelect"),
  orientationButton: document.querySelector("#orientationButton"),
  saveTemplateButton: document.querySelector("#saveTemplateButton"),
  printButton: document.querySelector("#printButton"),
  fieldList: document.querySelector("#fieldList"),
  rowHeightInput: document.querySelector("#rowHeightInput"),
  rowHeightValue: document.querySelector("#rowHeightValue"),
  paper: document.querySelector("#paper"),
  errorBox: document.querySelector("#errorBox")
};

let appState = null;
let currentSessionId = "";

function showError(error) {
  elements.errorBox.hidden = false;
  elements.errorBox.textContent = error.message ?? String(error);
}

function clearError() {
  elements.errorBox.hidden = true;
  elements.errorBox.textContent = "";
}

function option(value, label) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function renderFieldList() {
  elements.fieldList.replaceChildren();
  if (!appState) return;

  for (const column of appState.layout.columns) {
    const row = document.createElement("label");
    row.className = "field-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = column.visible;
    checkbox.addEventListener("change", () => {
      appState = toggleColumnVisible(appState, column.fieldId);
      render();
    });

    const label = document.createElement("input");
    label.type = "text";
    label.value = column.label;
    label.addEventListener("change", () => {
      appState = renameColumn(appState, column.fieldId, label.value);
      render();
    });

    const type = document.createElement("span");
    type.className = "field-type";
    type.textContent = column.type;

    row.append(checkbox, label, type);
    elements.fieldList.append(row);
  }
}

function renderPaper() {
  if (!appState) return;
  elements.sessionTitle.textContent = appState.session.title ?? currentSessionId;
  elements.paper.classList.toggle("portrait", appState.layout.paper.orientation === "portrait");
  elements.paper.classList.toggle("landscape", appState.layout.paper.orientation !== "portrait");
  elements.paper.style.setProperty("--row-height", `${appState.layout.table.rowHeight}px`);
  elements.paper.innerHTML = `<h1 class="paper-title"></h1>${renderPrintTable(appState.session, appState.layout, currentSessionId)}`;
  elements.paper.querySelector(".paper-title").textContent = appState.session.title ?? "拍摄脚本表";
  elements.rowHeightInput.value = String(appState.layout.table.rowHeight);
  elements.rowHeightValue.value = `${appState.layout.table.rowHeight}px`;
  elements.orientationButton.textContent = appState.layout.paper.orientation === "portrait" ? "纵向" : "横向";
}

function render() {
  renderFieldList();
  renderPaper();
}

async function loadSelected() {
  clearError();
  currentSessionId = elements.sessionSelect.value;
  const templateId = elements.templateSelect.value;
  if (!currentSessionId || !templateId) return;
  const [session, template] = await Promise.all([
    api.loadSession(currentSessionId),
    api.loadTemplate(templateId)
  ]);
  appState = createInitialState(session, template);
  render();
}

async function boot() {
  try {
    const [sessions, templates] = await Promise.all([api.listSessions(), api.listTemplates()]);
    elements.sessionSelect.replaceChildren(...sessions.map((item) => option(item.id, item.title)));
    elements.templateSelect.replaceChildren(...templates.map((item) => option(item.id, item.title)));
    await loadSelected();
  } catch (error) {
    showError(error);
  }
}

elements.sessionSelect.addEventListener("change", () => loadSelected().catch(showError));
elements.templateSelect.addEventListener("change", () => loadSelected().catch(showError));
elements.rowHeightInput.addEventListener("input", () => {
  if (!appState) return;
  appState = setRowHeight(appState, elements.rowHeightInput.value);
  renderPaper();
});
elements.orientationButton.addEventListener("click", () => {
  if (!appState) return;
  appState.layout.paper.orientation = appState.layout.paper.orientation === "portrait" ? "landscape" : "portrait";
  renderPaper();
});
elements.saveTemplateButton.addEventListener("click", async () => {
  if (!appState) return;
  clearError();
  try {
    await api.saveTemplate(toTemplate(appState.layout, appState.layout.name));
  } catch (error) {
    showError(error);
  }
});
elements.printButton.addEventListener("click", () => window.print());

boot();
```

- [ ] **Step 5.5: Add Task 7 frontend hardening tests**

Add focused frontend tests under `tests/frontend/` for these browser-shell quality gates:

- Visibility checkbox accessible names include the target field label.
- Async session/template loading is guarded so stale responses cannot update state or render.
- Preview asset rendering uses the loaded session id, not a later global selection.
- Preview resize handles are bound to pointer dragging and sync the layout panel width input.
- Print CSS declares `.print-table thead { display: table-header-group; }` and `.print-table tfoot { display: table-footer-group; }`.

- [ ] **Step 6: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add public/index.html public/js/api.js public/js/app.js public/styles/app.css public/styles/print.css tests/frontend/api.test.mjs tests/frontend/app-shell-source.test.mjs tests/frontend/print-css.test.mjs tests/frontend/state-layout.test.mjs
git commit -m "feat: add browser print preview shell"
```

Expected: commit succeeds.

## Task 8: Column Width Dragging And Template Persistence

**Status:** Completed during Task 7 hardening and verified in the Task 8 audit.

Audit note:
- Column order controls are wired in `public/js/app.js` through `data-move-field` buttons and `moveColumn`.
- Width number inputs call `resizeColumn` and immediately re-render the preview.
- Preview header resize handles are rendered by `renderPrintTable`, drag through pointer events, and sync the matching width input while dragging.
- Template saving posts `toTemplate(state.layout, trimmedName)` to `POST /api/templates`, refreshes the template list, selects the saved id, and keeps the saved title in state.
- Tests cover move/resize/template export state, preview resize-handle rendering and wiring, API POST behavior, saved-template state source wiring, and server-side save/reload persistence.

**Files:**
- Modify: `public/js/app.js`
- Modify: `public/styles/app.css`
- Modify: `public/js/state.js`
- Modify: `public/js/render.js`
- Modify: `tests/frontend/state-layout.test.mjs`
- Modify: `tests/frontend/render.test.mjs`

- [x] **Step 1: Add width-state test**

Append to `tests/frontend/state-layout.test.mjs`:

```js
import { moveColumn } from "../../public/js/state.js";

test("moveColumn reorders layout columns without changing session fields", () => {
  const session = { fields, rows: [] };
  const state = createInitialState(session, template);
  const moved = moveColumn(state, "reference", -1);
  assert.deepEqual(moved.layout.columns.map((column) => column.fieldId), ["reference", "shot_no", "voiceover"]);
  assert.deepEqual(session.fields.map((field) => field.id), ["shot_no", "voiceover", "reference"]);
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/frontend/state-layout.test.mjs
```

Expected: FAIL because `moveColumn` is not exported.

Audit result: this red step belongs to the original plan. By the Task 8 audit, `moveColumn` was already exported and covered.

- [x] **Step 3: Add moveColumn state function**

Append to `public/js/state.js`:

```js
export function moveColumn(state, fieldId, direction) {
  const layout = cloneLayout(state.layout);
  const index = layout.columns.findIndex((column) => column.fieldId === fieldId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= layout.columns.length) return state;
  const [column] = layout.columns.splice(index, 1);
  layout.columns.splice(nextIndex, 0, column);
  return { ...state, layout };
}
```

- [x] **Step 4: Add resize controls to field list**

Modify `public/js/app.js` imports:

```js
import { createInitialState, moveColumn, renameColumn, resizeColumn, setRowHeight, toTemplate, toggleColumnVisible } from "./state.js";
```

Replace the field item creation inside `renderFieldList()` with:

```js
const row = document.createElement("div");
row.className = "field-item";

const checkbox = document.createElement("input");
checkbox.type = "checkbox";
checkbox.checked = column.visible;
checkbox.addEventListener("change", () => {
  appState = toggleColumnVisible(appState, column.fieldId);
  render();
});

const label = document.createElement("input");
label.type = "text";
label.value = column.label;
label.addEventListener("change", () => {
  appState = renameColumn(appState, column.fieldId, label.value);
  render();
});

const type = document.createElement("span");
type.className = "field-type";
type.textContent = column.type;

const width = document.createElement("input");
width.type = "number";
width.min = "48";
width.max = "720";
width.value = String(column.width);
width.title = "列宽";
width.addEventListener("change", () => {
  appState = resizeColumn(appState, column.fieldId, width.value);
  render();
});

const up = document.createElement("button");
up.type = "button";
up.textContent = "↑";
up.title = "前移";
up.addEventListener("click", () => {
  appState = moveColumn(appState, column.fieldId, -1);
  render();
});

const down = document.createElement("button");
down.type = "button";
down.textContent = "↓";
down.title = "后移";
down.addEventListener("click", () => {
  appState = moveColumn(appState, column.fieldId, 1);
  render();
});

row.append(checkbox, label, type, width, up, down);
elements.fieldList.append(row);
```

- [x] **Step 5: Update field item CSS**

Replace `.field-item` rule in `public/styles/app.css`:

```css
.field-item {
  display: grid;
  grid-template-columns: 24px 1fr 58px 64px 28px 28px;
  gap: 8px;
  align-items: center;
  padding: 8px;
  background: white;
  border: 1px solid var(--line);
  border-radius: 6px;
}
```

Add:

```css
.field-item input[type="number"] {
  width: 64px;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 4px 6px;
}
.field-item button {
  width: 28px;
  height: 28px;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 4px;
}
```

- [x] **Step 6: Run frontend tests**

Append to `tests/frontend/render.test.mjs`:

```js
test("table headers include resize handles for visible columns", () => {
  const session = {
    title: "样例",
    rows: [{ id: "r1", cells: { shot_no: "01" } }]
  };
  const layout = {
    table: { rowHeight: 96 },
    columns: [{ fieldId: "shot_no", type: "text", label: "镜头号", visible: true, width: 64 }]
  };
  const html = renderPrintTable(session, layout, "sample");
  assert.match(html, /class="resize-handle"/);
  assert.match(html, /data-resize-field="shot_no"/);
});
```

- [x] **Step 7: Add resize handles to preview headers**

In `public/js/render.js`, replace the `header` constant inside `renderPrintTable()` with:

```js
const header = columns.map((column) => `
  <th style="width:${column.width}px">
    <span class="column-label">${escapeHtml(column.label)}</span>
    <span class="resize-handle" data-resize-field="${escapeHtml(column.fieldId)}" aria-hidden="true"></span>
  </th>
`).join("");
```

- [x] **Step 8: Wire pointer dragging in the preview**

Add this function to `public/js/app.js`:

```js
function bindColumnResize() {
  for (const handle of elements.paper.querySelectorAll(".resize-handle")) {
    handle.addEventListener("pointerdown", (event) => {
      if (!appState) return;
      event.preventDefault();
      const fieldId = handle.dataset.resizeField;
      const column = appState.layout.columns.find((item) => item.fieldId === fieldId);
      const startX = event.clientX;
      const startWidth = column.width;

      function onMove(moveEvent) {
        appState = resizeColumn(appState, fieldId, startWidth + moveEvent.clientX - startX);
        renderPaper();
      }

      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        renderFieldList();
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }
}
```

In `renderPaper()`, add this call after setting `elements.paper.innerHTML` and title text:

```js
bindColumnResize();
```

- [x] **Step 9: Style resize handles**

Add to `public/styles/app.css`:

```css
.print-table th {
  position: relative;
}
.column-label {
  display: block;
  padding-right: 8px;
}
.resize-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 2;
}
.resize-handle::after {
  content: "";
  position: absolute;
  top: 20%;
  bottom: 20%;
  left: 3px;
  border-left: 1px solid #777;
}
```

- [x] **Step 10: Run frontend tests**

Run:

```bash
node --test tests/frontend/state-layout.test.mjs tests/frontend/render.test.mjs
```

Expected: PASS.

- [x] **Step 11: Commit**

Run:

```bash
git add public/js/app.js public/js/state.js public/js/render.js public/styles/app.css tests/frontend/state-layout.test.mjs tests/frontend/render.test.mjs
git commit -m "feat: adjust columns from layout panel"
```

Expected: commit succeeds.

## Task 9: End-To-End Local Verification

**Files:**
- Create: `docs/usage.md`

- [ ] **Step 1: Start the local app**

Run:

```bash
npm start
```

Expected terminal output:

```text
HTMLprinter running at http://localhost:4173
```

- [ ] **Step 2: Open app in the in-app browser**

Open:

```text
http://localhost:4173
```

Expected:

- sample session loads
- balanced template loads
- A4 landscape paper appears
- cells are not editable
- image reference cells show SVG assets
- row-height slider changes image scale
- width number input changes the corresponding column width
- print button opens the browser print dialog

- [ ] **Step 3: Save a changed template**

Change a column label to `镜次`, set the image column width to `320`, click `保存模板`, then inspect:

```bash
cat templates/shot-script/balanced-landscape.json
```

Expected: template JSON contains `"label": "镜次"` and `"width": 320`.

- [ ] **Step 4: Create usage document**

Create `docs/usage.md`:

````md
# HTMLprinter Usage

## Start

Run:

```sh
npm start
```

Open:

```text
http://localhost:4173
```

## Session Package

Each import lives in `imports/<session-id>/`.

Required:

- `data.json`
- `assets/` for local image files

Image paths in `data.json` are relative to the session folder, for example `assets/shot-001-ref.jpg`.

## Printing

Use the `打印` button. The browser print dialog can send to a printer or save as PDF.

## Content Editing

The app does not edit imported script content. Change content in the source system or regenerate the session JSON.
````

- [ ] **Step 5: Run final tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add docs/usage.md templates/shot-script/balanced-landscape.json
git commit -m "docs: add htmlprinter usage guide"
```

Expected: commit succeeds.

## Self-Review Checklist

- Spec coverage:
  - Local service: Tasks 3 and 4.
  - Session JSON: Tasks 1, 2, 3, and 4.
  - Shared templates: Tasks 1, 2, 3, 4, and 8.
  - Read-only frontend: Tasks 5, 6, and 7.
  - Field rename/show/hide/order/width: Tasks 5 and 8.
  - Preview drag-resize column widths: Task 8.
  - Row height: Tasks 5 and 7.
  - A4 preview and print: Tasks 7 and 9.
  - Image resizing with cells: Tasks 6, 7, and 9.
  - No direct Feishu integration: enforced by architecture and usage docs.
- Placeholder scan:
  - No task uses placeholder implementation language.
  - All code-changing steps include exact code blocks.
- Type consistency:
  - Field types are consistently `text`, `multiSelect`, and `image`.
  - Template property names are consistently `paper`, `table`, and `columns`.
  - Layout columns consistently use `fieldId`, `label`, `visible`, `width`, and `type`.
