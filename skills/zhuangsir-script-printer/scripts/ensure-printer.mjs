#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundledProjectRoot = path.resolve(__dirname, "../../..");
const DEFAULT_REPO = "https://github.com/billzhuang6569/videoscripts-printer.git";
const DEFAULT_INSTALL_DIR = path.join(os.homedir(), "Documents", "ZhuangSir", "videoscripts-printer");
const DEFAULT_PORT = 4173;

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isPrinterRoot(dir) {
  if (!dir || !existsSync(dir)) return false;
  if (!existsSync(path.join(dir, "src", "server", "server.mjs"))) return false;
  if (!existsSync(path.join(dir, "src", "server", "validation.mjs"))) return false;
  if (!existsSync(path.join(dir, "public", "index.html"))) return false;
  if (!existsSync(path.join(dir, "templates", "shot-script", "balanced-landscape.json"))) return false;

  try {
    const packageJson = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
    return ["videoscripts-printer", "htmlprinter"].includes(packageJson.name);
  } catch {
    return false;
  }
}

function parentsFrom(start) {
  const dirs = [];
  let current = path.resolve(start);
  while (current && current !== path.dirname(current)) {
    dirs.push(current);
    current = path.dirname(current);
  }
  return dirs;
}

function candidateRoots() {
  const candidates = [
    argValue("--root"),
    process.env.HTMLPRINTER_ROOT,
    process.cwd(),
    ...parentsFrom(process.cwd()),
    bundledProjectRoot,
    path.join(os.homedir(), "HTMLprinter"),
    path.join(os.homedir(), "videoscripts-printer"),
    path.join(os.homedir(), "Documents", "HTMLprinter"),
    path.join(os.homedir(), "Documents", "videoscripts-printer"),
    DEFAULT_INSTALL_DIR
  ];

  return [...new Set(candidates.filter(Boolean).map((item) => path.resolve(item)))];
}

function findPrinterRoot() {
  return candidateRoots().find(isPrinterRoot) || "";
}

async function installPrinter() {
  const installDir = path.resolve(argValue("--install-dir") || DEFAULT_INSTALL_DIR);
  const repo = argValue("--repo") || DEFAULT_REPO;

  if (isPrinterRoot(installDir)) {
    return { root: installDir, installed: false };
  }

  if (existsSync(installDir)) {
    fail(`Install directory exists but is not a valid HTML printer: ${installDir}\nPass --root <existing-printer-root> or choose a new --install-dir.`);
  }

  await mkdir(path.dirname(installDir), { recursive: true });
  await execFileAsync("git", ["clone", "--depth", "1", repo, installDir], {
    env: process.env,
    maxBuffer: 1024 * 1024 * 8
  });

  if (!isPrinterRoot(installDir)) {
    fail(`Installed repository is not a valid HTML printer: ${installDir}`);
  }

  return { root: installDir, installed: true };
}

function checkHttp(port) {
  return new Promise((resolve) => {
    const request = http.get({ host: "127.0.0.1", port, path: "/", timeout: 1200 }, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });

    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

async function startPrinter(root, port) {
  if (await checkHttp(port)) return { running: true, started: false };

  const tmpDir = path.join(root, ".tmp");
  await mkdir(tmpDir, { recursive: true });
  const logPath = path.join(tmpDir, "htmlprinter-server.log");
  const out = createWriteStream(logPath, { flags: "a" });
  const child = spawn("npm", ["start"], {
    cwd: root,
    detached: true,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", out, out]
  });

  child.unref();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (await checkHttp(port)) {
      return { running: true, started: true, pid: child.pid, logPath };
    }
  }

  return { running: false, started: true, pid: child.pid, logPath };
}

async function main() {
  const port = Number(argValue("--port") || DEFAULT_PORT);
  let root = findPrinterRoot();
  let installed = false;

  if (!root && hasFlag("--install")) {
    const result = await installPrinter();
    root = result.root;
    installed = result.installed;
  }

  if (!root) {
    fail(
      [
        "HTML printer is not installed or could not be found.",
        `Recommended install command: node ${path.relative(process.cwd(), fileURLToPath(import.meta.url))} --install --start`,
        "If it is already installed, set HTMLPRINTER_ROOT or pass --root <project-root>."
      ].join("\n")
    );
  }

  const server = hasFlag("--start") ? await startPrinter(root, port) : { running: await checkHttp(port), started: false };
  const url = `http://localhost:${port}/`;

  console.log(
    JSON.stringify(
      {
        root,
        installed,
        running: server.running,
        started: server.started,
        pid: server.pid ?? null,
        logPath: server.logPath ?? null,
        url,
        writeSessionCommand: `node skills/zhuangsir-script-printer/scripts/write-session.mjs --root ${JSON.stringify(root)} --input <session-json-file>`
      },
      null,
      2
    )
  );
}

main().catch((error) => fail(error?.message || String(error)));
