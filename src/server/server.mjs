import { createServer } from "node:http";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mimeTypeFor } from "./mime.mjs";
import { createRepository, ensureInside } from "./repository.mjs";
import { validateSessionData, validateTemplate } from "./validation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_PUBLIC = path.join(DEFAULT_ROOT, "public");
const NOT_FOUND_MESSAGES = ["非法 session 路径", "非法图片路径", "非法模板路径", "非法静态文件路径"];

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function validationError(errors) {
  const error = new Error("数据校验失败");
  error.statusCode = 422;
  error.errors = errors;
  return error;
}

function statusForError(error) {
  if (error?.statusCode) return error.statusCode;
  if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return 404;
  if (NOT_FOUND_MESSAGES.includes(error?.message)) return 404;
  if (error instanceof SyntaxError) return 422;
  return 500;
}

function errorsForResponse(error, status) {
  if (Array.isArray(error?.errors)) return error.errors;
  if (status === 500) return ["服务器内部错误"];
  return [error?.message || "请求失败"];
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const body = Buffer.concat(chunks).toString("utf8").trim();
  return body.length > 0 ? JSON.parse(body) : {};
}

async function sendFile(res, filePath) {
  const stats = await lstat(filePath);
  if (!stats.isFile()) {
    const error = new Error("文件不存在");
    error.statusCode = 404;
    throw error;
  }

  const data = await readFile(filePath);
  res.writeHead(200, { "content-type": mimeTypeFor(filePath) });
  res.end(data);
}

function collectSessionImagePaths(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.fields) || !Array.isArray(data.rows)) {
    return [];
  }

  const imageFieldIds = new Set(
    data.fields
      .filter((field) => field && typeof field === "object" && field.type === "image" && typeof field.id === "string")
      .map((field) => field.id)
  );
  const imagePaths = new Set();

  for (const row of data.rows) {
    if (!row || typeof row !== "object" || !row.cells || typeof row.cells !== "object") continue;

    for (const fieldId of imageFieldIds) {
      const value = row.cells[fieldId];
      if (!Array.isArray(value)) continue;

      for (const image of value) {
        if (image && typeof image === "object" && typeof image.path === "string") {
          imagePaths.add(image.path);
        }
      }
    }
  }

  return [...imagePaths];
}

function normalizeSessionImagePath(imagePath) {
  if (typeof imagePath !== "string" || imagePath.trim().length === 0) return null;
  if (imagePath.includes("\\") || /^[a-zA-Z]:/.test(imagePath) || path.posix.isAbsolute(imagePath)) return null;

  const normalized = path.posix.normalize(imagePath);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) return null;

  return normalized;
}

async function resolveExistingImagePaths(repo, sessionId, data) {
  const result = new Map();

  await Promise.all(
    collectSessionImagePaths(data).map(async (imagePath) => {
      const normalizedPath = normalizeSessionImagePath(imagePath);

      try {
        await repo.resolveAsset(sessionId, imagePath);
        result.set(imagePath, true);
        if (normalizedPath) result.set(normalizedPath, true);
      } catch {
        result.set(imagePath, false);
        if (normalizedPath) result.set(normalizedPath, false);
      }
    })
  );

  return result;
}

async function validateLoadedSession(repo, sessionId, data) {
  const existingImagePaths = await resolveExistingImagePaths(repo, sessionId, data);
  const result = validateSessionData(data, {
    imageExists: (imagePath) => existingImagePaths.get(imagePath) !== false
  });

  if (result.errors.length > 0) throw validationError(result.errors);
}

function assetRouteParts(pathname) {
  const prefix = "/assets/";
  const rest = pathname.slice(prefix.length);
  const slashIndex = rest.indexOf("/");

  if (slashIndex === -1) return [decodeURIComponent(rest), ""];

  return [decodeURIComponent(rest.slice(0, slashIndex)), decodeURIComponent(rest.slice(slashIndex + 1))];
}

function staticFilePath(publicDir, pathname) {
  const requestPath = pathname === "/" ? "/index.html" : pathname;
  return ensureInside(publicDir, path.join(publicDir, decodeURIComponent(requestPath)), "非法静态文件路径");
}

export function createAppServer({ rootDir = DEFAULT_ROOT, publicDir = DEFAULT_PUBLIC } = {}) {
  const repo = createRepository(rootDir);

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/api/sessions") {
        return sendJson(res, 200, await repo.listSessions());
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/sessions/")) {
        const sessionId = decodeURIComponent(url.pathname.slice("/api/sessions/".length));
        const data = await repo.loadSession(sessionId);
        await validateLoadedSession(repo, sessionId, data);
        return sendJson(res, 200, data);
      }

      if (req.method === "GET" && url.pathname === "/api/templates") {
        return sendJson(res, 200, await repo.listTemplates());
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/templates/")) {
        const templateId = decodeURIComponent(url.pathname.slice("/api/templates/".length));
        const template = await repo.loadTemplate(templateId);
        const result = validateTemplate(template);
        if (result.errors.length > 0) throw validationError(result.errors);
        return sendJson(res, 200, template);
      }

      if (req.method === "POST" && url.pathname === "/api/templates") {
        const template = await readJsonBody(req);
        const result = validateTemplate(template);
        if (result.errors.length > 0) throw validationError(result.errors);
        return sendJson(res, 201, await repo.saveTemplate(template));
      }

      if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
        const [sessionId, assetPath] = assetRouteParts(url.pathname);
        return sendFile(res, await repo.resolveAsset(sessionId, assetPath));
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        return sendJson(res, 404, { errors: ["接口不存在"] });
      }

      return sendFile(res, staticFilePath(publicDir, url.pathname));
    } catch (error) {
      const status = statusForError(error);
      return sendJson(res, status, { errors: errorsForResponse(error, status) });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createAppServer().listen(port, () => {
    console.log(`HTMLprinter running at http://localhost:${port}`);
  });
}
