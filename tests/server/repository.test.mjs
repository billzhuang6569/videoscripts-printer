import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createRepository, ensureInside, safeTemplateFileName, sessionAssetPath } from "../../src/server/repository.mjs";

async function makeRepoRoot() {
  return mkdtemp(path.join(tmpdir(), "htmlprinter-"));
}

test("lists sessions and loads session JSON", async () => {
  const root = await makeRepoRoot();
  await mkdir(path.join(root, "imports", "sample", "assets"), { recursive: true });
  await mkdir(path.join(root, "imports", "empty"), { recursive: true });
  await writeFile(
    path.join(root, "imports", "sample", "data.json"),
    JSON.stringify({ title: "Sample Shoot", fields: [], rows: [] })
  );

  const repo = createRepository(root);

  assert.deepEqual(await repo.listSessions(), [{ id: "sample", title: "Sample Shoot" }]);
  assert.deepEqual(await repo.loadSession("sample"), { title: "Sample Shoot", fields: [], rows: [] });
});

test("lists, loads, and saves templates under shot-script templates", async () => {
  const root = await makeRepoRoot();
  const repo = createRepository(root);
  const template = {
    name: "均衡 横版 / v1",
    paper: { size: "A4", orientation: "landscape" },
    table: { rowHeight: 96, avoidRowPageBreak: true },
    columns: []
  };

  const saved = await repo.saveTemplate(template);

  assert.equal(saved.id, "balanced-v1.json");
  assert.equal(saved.title, "均衡 横版 / v1");
  assert.deepEqual(await repo.listTemplates(), [{ id: "balanced-v1.json", title: "均衡 横版 / v1" }]);
  assert.deepEqual(await repo.loadTemplate("balanced-v1.json"), template);

  const text = await readFile(path.join(root, "templates", "shot-script", saved.id), "utf8");
  assert.match(text, /均衡 横版/);
});

test("safeTemplateFileName generates stable safe JSON filenames", () => {
  assert.equal(safeTemplateFileName("Storyboard Heavy"), "storyboard-heavy.json");
  assert.equal(safeTemplateFileName("均衡 横版 / v1"), "balanced-v1.json");
  assert.equal(safeTemplateFileName("中文模板 一"), "中文模板-一.json");
  assert.equal(safeTemplateFileName("中文模板 二"), "中文模板-二.json");
  assert.notEqual(safeTemplateFileName("模板！"), safeTemplateFileName("模板？"));
  assert.equal(safeTemplateFileName("模板！"), safeTemplateFileName("模板！"));
  assert.match(safeTemplateFileName("../../../"), /^template-[a-f0-9]{8}\.json$/);
  assert.match(safeTemplateFileName("My_Template--Draft!!.json"), /^my_template-draftjson-[a-f0-9]{8}\.json$/);
});

test("ensureInside allows contained paths and rejects escapes", () => {
  const base = path.join(tmpdir(), "htmlprinter-base");

  assert.equal(ensureInside(base, path.join(base, "child", "file.json"), "非法路径"), path.resolve(base, "child", "file.json"));
  assert.throws(() => ensureInside(base, path.join(base, "..", "outside.json"), "非法路径"), /非法路径/);
});

test("sessionAssetPath allows normalized contained asset paths", async () => {
  const root = await makeRepoRoot();
  await mkdir(path.join(root, "imports", "sample", "assets"), { recursive: true });
  await writeFile(path.join(root, "imports", "sample", "assets", "shot..v2.svg"), "<svg />");
  await writeFile(path.join(root, "imports", "sample", "assets", "shot.svg"), "<svg />");

  assert.equal(
    await sessionAssetPath(root, "sample", "assets/shot..v2.svg"),
    await realpath(path.join(root, "imports", "sample", "assets", "shot..v2.svg"))
  );
  assert.equal(
    await sessionAssetPath(root, "sample", "assets/../assets/shot.svg"),
    await realpath(path.join(root, "imports", "sample", "assets", "shot.svg"))
  );
});

test("sessionAssetPath rejects session and asset traversal", async () => {
  const root = path.join(tmpdir(), "htmlprinter-root");

  await assert.rejects(() => sessionAssetPath(root, "../sample", "assets/shot.svg"), /非法 session 路径/);
  await assert.rejects(() => sessionAssetPath(root, "sample", "../secret.png"), /非法图片路径/);
  await assert.rejects(() => sessionAssetPath(root, "sample", "assets/../../secret.png"), /非法图片路径/);
  await assert.rejects(() => sessionAssetPath(root, "sample", path.resolve(root, "outside.svg")), /非法图片路径/);
  await assert.rejects(() => sessionAssetPath(root, "sample", "assets\\..\\secret.png"), /非法图片路径/);
});

test("sessionAssetPath rejects symlink escapes outside the session", async () => {
  const root = await makeRepoRoot();
  const sessionAssets = path.join(root, "imports", "sample", "assets");
  const outside = path.join(root, "outside");
  await mkdir(sessionAssets, { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(path.join(outside, "secret.svg"), "<svg />");
  await symlink(path.join(outside, "secret.svg"), path.join(sessionAssets, "escape.svg"));
  await symlink(outside, path.join(sessionAssets, "linked"));

  await assert.rejects(() => sessionAssetPath(root, "sample", "assets/escape.svg"), /非法图片路径/);
  await assert.rejects(() => sessionAssetPath(root, "sample", "assets/linked/secret.svg"), /非法图片路径/);
});

test("repository rejects template path traversal", async () => {
  const root = await makeRepoRoot();
  const repo = createRepository(root);

  await assert.rejects(() => repo.resolveAsset("sample", "../secret.svg"), /非法图片路径/);
  await assert.rejects(() => repo.loadTemplate("../secret.json"), /非法模板路径/);
  await assert.rejects(() => repo.loadTemplate("nested/template.json"), /非法模板路径/);
  await assert.rejects(() => repo.loadTemplate("nested\\template.json"), /非法模板路径/);
  await assert.rejects(() => repo.loadTemplate("template"), /非法模板路径/);
  await assert.rejects(() => repo.loadTemplate(".json"), /非法模板路径/);
  await assert.rejects(() => repo.loadSession("../sample"), /非法 session 路径/);
  await assert.rejects(() => repo.loadSession("nested/sample"), /非法 session 路径/);
  await assert.rejects(() => repo.loadSession("nested\\sample"), /非法 session 路径/);
});

test("saveTemplate rejects an existing symlinked template file", async () => {
  const root = await makeRepoRoot();
  const repo = createRepository(root);
  const templates = path.join(root, "templates", "shot-script");
  const outside = path.join(root, "outside-template.json");
  await mkdir(templates, { recursive: true });
  await writeFile(outside, "outside");
  await symlink(outside, path.join(templates, "storyboard-heavy.json"));

  await assert.rejects(() => repo.saveTemplate({ name: "Storyboard Heavy", columns: [] }), /非法模板路径/);
  assert.equal(await readFile(outside, "utf8"), "outside");
});
