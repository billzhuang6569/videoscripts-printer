import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve(".agents/skills/zhuangsir-script-printer/scripts/write-session.mjs");

test("write-session creates a printer session and copies relative image assets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "htmlprinter-skill-root-"));
  const source = await mkdtemp(path.join(tmpdir(), "htmlprinter-skill-source-"));
  await mkdir(path.join(source, "assets"), { recursive: true });
  await writeFile(path.join(source, "assets", "ref.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\" />");

  const input = {
    title: "原始脚本",
    source: { type: "direct", name: "test-source" },
    fields: [
      { id: "shot_no", name: "镜头号", type: "text" },
      { id: "todo", name: "待办", type: "todo" },
      { id: "reference", name: "画面参考/分镜", type: "image" }
    ],
    rows: [
      {
        id: "row_001",
        cells: {
          shot_no: "01",
          todo: ["[ ] 确认场地", "[x] 准备脱敏屏幕"],
          reference: [{ path: "assets/ref.svg", caption: "原 caption 照抄" }]
        }
      }
    ]
  };
  const inputPath = path.join(source, "data.json");
  await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");

  const { stdout } = await execFileAsync(process.execPath, [scriptPath, "--input", inputPath, "--session-id", "skill-copy", "--root", root]);
  const result = JSON.parse(stdout);
  const sessionData = JSON.parse(await readFile(path.join(root, "imports", "skill-copy", "data.json"), "utf8"));
  const copiedAsset = await readFile(path.join(root, "imports", "skill-copy", "assets", "ref.svg"), "utf8");

  assert.equal(result.sessionId, "skill-copy");
  assert.equal(sessionData.rows[0].cells.shot_no, "01");
  assert.deepEqual(sessionData.rows[0].cells.todo, ["[ ] 确认场地", "[x] 准备脱敏屏幕"]);
  assert.deepEqual(sessionData.rows[0].cells.reference, [{ path: "assets/ref.svg", caption: "原 caption 照抄" }]);
  assert.equal(copiedAsset, "<svg xmlns=\"http://www.w3.org/2000/svg\" />");
});
