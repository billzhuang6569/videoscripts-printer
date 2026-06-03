#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSessionData } from "../../../../src/server/validation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../..");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function safeSegment(value) {
  const raw = String(value ?? "").normalize("NFKC").trim();
  const ascii = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (ascii) return ascii.slice(0, 72);
  return createHash("sha256").update(raw || String(Date.now())).digest("hex").slice(0, 12);
}

function timestampId() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

function defaultSessionId(session) {
  return `${timestampId()}-${safeSegment(session.title || "script-print")}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isImageField(field) {
  return field?.type === "image" && typeof field.id === "string";
}

function uniqueAssetName(existing, sourcePath) {
  const parsed = path.parse(sourcePath);
  const base = safeSegment(parsed.name) || "image";
  const ext = parsed.ext.toLowerCase();
  let name = `${base}${ext}`;
  let counter = 2;
  while (existing.has(name)) {
    name = `${base}-${counter}${ext}`;
    counter += 1;
  }
  existing.add(name);
  return name;
}

async function prepareImages(session, inputDir, sessionDir) {
  const imageFieldIds = new Set(session.fields.filter(isImageField).map((field) => field.id));
  const assetsDir = path.join(sessionDir, "assets");
  const usedAssetNames = new Set();
  const copied = [];

  for (const row of session.rows) {
    if (!isPlainObject(row?.cells)) continue;

    for (const fieldId of imageFieldIds) {
      const value = row.cells[fieldId];
      if (!Array.isArray(value)) continue;

      for (const image of value) {
        if (!isPlainObject(image) || typeof image.path !== "string") continue;
        const currentPath = image.path;
        const sourcePath = path.isAbsolute(currentPath) ? currentPath : path.resolve(inputDir, currentPath);

        if (!path.isAbsolute(currentPath) && currentPath.startsWith("assets/") && existsSync(path.resolve(sessionDir, currentPath))) {
          continue;
        }

        await mkdir(assetsDir, { recursive: true });
        const assetName = uniqueAssetName(usedAssetNames, sourcePath);
        const targetPath = path.join(assetsDir, assetName);
        await copyFile(sourcePath, targetPath);
        image.path = `assets/${assetName}`;
        copied.push({ from: sourcePath, to: image.path });
      }
    }
  }

  return copied;
}

function imageExistsForSession(sessionDir, imagePath) {
  if (typeof imagePath !== "string" || path.isAbsolute(imagePath) || imagePath.includes("\\")) return false;
  const candidate = path.resolve(sessionDir, imagePath);
  if (!existsSync(candidate)) return false;
  const sessionReal = realpathSync(sessionDir);
  const candidateReal = realpathSync(candidate);
  return candidateReal.length > 0 && !path.relative(sessionReal, candidateReal).startsWith("..");
}

async function main() {
  const inputPath = argValue("--input");
  const rootDir = path.resolve(argValue("--root") || projectRoot);
  if (!inputPath) fail("Usage: write-session.mjs --input <session-json-file> [--session-id <id>] [--root <project-root>]");

  const resolvedInputPath = path.resolve(inputPath);
  const inputDir = path.dirname(resolvedInputPath);
  const session = JSON.parse(await readFile(resolvedInputPath, "utf8"));
  const sessionId = safeSegment(argValue("--session-id") || defaultSessionId(session));
  const sessionDir = path.join(rootDir, "imports", sessionId);

  await mkdir(sessionDir, { recursive: true });
  const copiedAssets = await prepareImages(session, inputDir, sessionDir);

  const validation = validateSessionData(session, {
    imageExists: (imagePath) => imageExistsForSession(sessionDir, imagePath)
  });
  if (validation.errors.length > 0) {
    fail(`Session validation failed:\n${validation.errors.map((error) => `- ${error}`).join("\n")}`);
  }

  const dataPath = path.join(sessionDir, "data.json");
  await writeFile(dataPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");

  const url = `http://localhost:4173/?session=${encodeURIComponent(sessionId)}&template=balanced-landscape.json`;
  console.log(
    JSON.stringify(
      {
        sessionId,
        sessionDir,
        dataPath,
        url,
        copiedAssets
      },
      null,
      2
    )
  );
}

main().catch((error) => fail(error?.message || String(error)));
