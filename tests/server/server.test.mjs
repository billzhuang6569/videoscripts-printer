import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createAppServer } from "../../src/server/server.mjs";

async function fixtureRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "htmlprinter-server-"));
  const publicDir = path.join(root, "public");

  await mkdir(path.join(root, "imports", "sample", "assets", "nested"), { recursive: true });
  await mkdir(path.join(root, "imports", "invalid", "assets"), { recursive: true });
  await mkdir(path.join(root, "templates", "shot-script"), { recursive: true });
  await mkdir(publicDir, { recursive: true });

  await writeFile(
    path.join(root, "imports", "sample", "data.json"),
    JSON.stringify({
      title: "Sample Shoot",
      fields: [
        { id: "shot_no", name: "镜头号", type: "text" },
        { id: "reference", name: "参考", type: "image" }
      ],
      rows: [
        {
          id: "r1",
          cells: {
            shot_no: "01",
            reference: [{ path: "assets/nested/shot.svg", caption: "图" }]
          }
        }
      ]
    })
  );
  await writeFile(
    path.join(root, "imports", "invalid", "data.json"),
    JSON.stringify({
      fields: [{ id: "reference", name: "参考", type: "image" }],
      rows: [{ id: "r1", cells: { reference: [{ path: "assets/../missing.svg" }] } }]
    })
  );
  await writeFile(
    path.join(root, "templates", "shot-script", "balanced-landscape.json"),
    JSON.stringify({
      name: "均衡横版",
      paper: { size: "A4", orientation: "landscape" },
      table: { rowHeight: 96, avoidRowPageBreak: true },
      columns: [{ fieldId: "shot_no", label: "镜头号", visible: true, width: 64 }]
    })
  );
  await writeFile(path.join(root, "imports", "sample", "assets", "nested", "shot.svg"), "<svg/>");
  await writeFile(path.join(publicDir, "index.html"), "<!doctype html><title>HTMLprinter</title>");

  return { root, publicDir };
}

async function withServer(t) {
  const { root, publicDir } = await fixtureRoot();
  const server = createAppServer({ rootDir: root, publicDir });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

test("server lists sessions and templates", async (t) => {
  const base = await withServer(t);

  const sessions = await fetch(`${base}/api/sessions`).then((res) => res.json());
  const templates = await fetch(`${base}/api/templates`).then((res) => res.json());

  assert.equal(sessions[0].id, "invalid");
  assert.equal(sessions[1].id, "sample");
  assert.equal(templates[0].id, "balanced-landscape.json");
});

test("server loads validated session and rejects missing or invalid sessions", async (t) => {
  const base = await withServer(t);

  const ok = await fetch(`${base}/api/sessions/sample`).then((res) => res.json());
  const missing = await fetch(`${base}/api/sessions/missing`);
  const invalid = await fetch(`${base}/api/sessions/invalid`);
  const invalidBody = await invalid.json();

  assert.equal(ok.rows[0].cells.shot_no, "01");
  assert.equal(missing.status, 404);
  assert.equal(invalid.status, 422);
  assert.match(invalidBody.errors[0], /图片不存在/);
});

test("server loads and saves validated templates", async (t) => {
  const base = await withServer(t);

  const loaded = await fetch(`${base}/api/templates/balanced-landscape.json`).then((res) => res.json());
  const invalid = await fetch(`${base}/api/templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "" })
  });
  const saved = await fetch(`${base}/api/templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Server Template",
      paper: { size: "A4", orientation: "portrait" },
      table: { rowHeight: 80, avoidRowPageBreak: true },
      columns: [{ fieldId: "shot_no", label: "镜次", visible: true, width: 88 }]
    })
  });
  const savedBody = await saved.json();
  const reloaded = await fetch(`${base}/api/templates/${savedBody.id}`).then((res) => res.json());

  assert.equal(loaded.name, "均衡横版");
  assert.equal(invalid.status, 422);
  assert.equal(saved.status, 201);
  assert.equal(savedBody.id, "server-template.json");
  assert.equal(reloaded.name, "Server Template");
  assert.equal(reloaded.columns[0].label, "镜次");
  assert.equal(reloaded.columns[0].width, 88);
});

test("server rejects malformed percent-encoded paths as client errors", async (t) => {
  const base = await withServer(t);

  const staticPath = await fetch(`${base}/%E0%A4%A`);
  const apiPath = await fetch(`${base}/api/sessions/%E0%A4%A`);

  assert.equal(staticPath.status, 400);
  assert.equal(apiPath.status, 400);
});

test("server distinguishes malformed JSON from schema validation", async (t) => {
  const base = await withServer(t);

  const malformed = await fetch(`${base}/api/templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{"
  });
  const invalidSchema = await fetch(`${base}/api/templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "" })
  });

  assert.equal(malformed.status, 400);
  assert.equal(invalidSchema.status, 422);
});

test("server enforces JSON content type and size for template posts", async (t) => {
  const base = await withServer(t);

  const wrongType = await fetch(`${base}/api/templates`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ name: "" })
  });
  const oversized = await fetch(`${base}/api/templates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x".repeat(1024 * 1024) })
  });

  assert.equal(wrongType.status, 415);
  assert.equal(oversized.status, 413);
});

test("server returns method not allowed for known API routes", async (t) => {
  const base = await withServer(t);

  const response = await fetch(`${base}/api/sessions`, { method: "POST" });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
});

test("server serves static frontend and encoded session assets", async (t) => {
  const base = await withServer(t);

  const html = await fetch(`${base}/`).then(async (res) => ({ status: res.status, body: await res.text() }));
  const asset = await fetch(`${base}/assets/sample/${encodeURIComponent("assets/nested/shot.svg")}`);
  const missingAsset = await fetch(`${base}/assets/sample/${encodeURIComponent("assets/missing.svg")}`);

  assert.equal(html.status, 200);
  assert.match(html.body, /HTMLprinter/);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get("content-type"), "image/svg+xml");
  assert.equal(await asset.text(), "<svg/>");
  assert.equal(missingAsset.status, 404);
});
