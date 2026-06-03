import { createHash } from "node:crypto";
import { access, lstat, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

const TEMPLATE_DIR = path.join("templates", "shot-script");

const NAME_ALIASES = new Map([
  ["均衡 横版 / v1", "balanced-v1"],
  ["均衡横版脚本表", "balanced-landscape"],
  ["分镜图优先", "storyboard-heavy"],
  ["文本优先", "narration-heavy"]
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isSinglePathSegment(value) {
  return isNonEmptyString(value) && !path.isAbsolute(value) && !value.includes("/") && !value.includes("\\") && value !== "." && value !== "..";
}

function isTemplateFileName(value) {
  return isSinglePathSegment(value) && value.length > ".json".length && value.endsWith(".json");
}

function readTitle(value, fallback) {
  return value && typeof value === "object" && typeof value.name === "string" && value.name.length > 0
    ? value.name
    : fallback;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

export function safeTemplateFileName(name) {
  const alias = NAME_ALIASES.get(name);
  if (alias) return `${alias}.json`;

  const raw = typeof name === "string" ? name : "";
  const normalized = raw.normalize("NFKC");
  const slug = raw
    .normalize("NFKC")
    .replace(/[\\/]+/gu, " ")
    .replace(/[^\p{Letter}\p{Number}_\s-]+/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-");

  if (!slug) return raw.length > 0 ? `template-${shortHash(normalized)}.json` : "template.json";

  const comparable = normalized
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-");
  const suffix = slug === comparable ? "" : `-${shortHash(normalized)}`;

  return `${slug}${suffix}.json`;
}

export function ensureInside(basePath, candidatePath, message = "非法路径") {
  const resolvedBase = path.resolve(basePath);
  const resolvedCandidate = path.resolve(candidatePath);
  const relative = path.relative(resolvedBase, resolvedCandidate);

  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return resolvedCandidate;
  }

  throw new Error(message);
}

export async function sessionAssetPath(rootDir, sessionId, assetPath) {
  if (!isSinglePathSegment(sessionId)) {
    throw new Error("非法 session 路径");
  }
  if (!isNonEmptyString(assetPath) || path.isAbsolute(assetPath) || assetPath.includes("\\")) {
    throw new Error("非法图片路径");
  }

  const importsDir = path.join(rootDir, "imports");
  const sessionDir = ensureInside(importsDir, path.join(importsDir, sessionId), "非法 session 路径");
  const assetCandidate = ensureInside(sessionDir, path.join(sessionDir, assetPath), "非法图片路径");
  const sessionStats = await lstat(sessionDir);

  if (!sessionStats.isDirectory() || sessionStats.isSymbolicLink()) {
    throw new Error("非法 session 路径");
  }

  const [importsRealPath, sessionRealPath, assetRealPath] = await Promise.all([
    realpath(importsDir),
    realpath(sessionDir),
    realpath(assetCandidate)
  ]);

  ensureInside(importsRealPath, sessionRealPath, "非法 session 路径");
  return ensureInside(sessionRealPath, assetRealPath, "非法图片路径");
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

        const dataPath = ensureInside(importsDir, path.join(importsDir, entry.name, "data.json"), "非法 session 路径");
        if (!(await exists(dataPath))) continue;

        const data = await readJson(dataPath);
        sessions.push({ id: entry.name, title: typeof data.title === "string" && data.title.length > 0 ? data.title : entry.name });
      }

      return sessions.sort((a, b) => a.id.localeCompare(b.id));
    },

    async loadSession(sessionId) {
      if (!isSinglePathSegment(sessionId)) {
        throw new Error("非法 session 路径");
      }

      const filePath = ensureInside(importsDir, path.join(importsDir, sessionId, "data.json"), "非法 session 路径");
      return readJson(filePath);
    },

    async saveSession(sessionId, data) {
      if (!isSinglePathSegment(sessionId)) {
        throw new Error("非法 session 路径");
      }

      const sessionDir = ensureInside(importsDir, path.join(importsDir, sessionId), "非法 session 路径");
      const filePath = ensureInside(sessionDir, path.join(sessionDir, "data.json"), "非法 session 路径");

      try {
        const existing = await lstat(filePath);
        if (existing.isSymbolicLink()) {
          throw new Error("非法 session 路径");
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        throw new Error("非法 session 路径");
      }

      await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      return { id: sessionId, title: readTitle(data, sessionId) };
    },

    async loadSessionLayout(sessionId) {
      if (!isSinglePathSegment(sessionId)) {
        throw new Error("非法 session 路径");
      }

      const sessionDir = ensureInside(importsDir, path.join(importsDir, sessionId), "非法 session 路径");
      const filePath = ensureInside(sessionDir, path.join(sessionDir, "layout.json"), "非法 session 路径");

      try {
        return await readJson(filePath);
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw error;
      }
    },

    async saveSessionLayout(sessionId, layout) {
      if (!isSinglePathSegment(sessionId)) {
        throw new Error("非法 session 路径");
      }

      const sessionDir = ensureInside(importsDir, path.join(importsDir, sessionId), "非法 session 路径");
      const dataPath = ensureInside(sessionDir, path.join(sessionDir, "data.json"), "非法 session 路径");
      const filePath = ensureInside(sessionDir, path.join(sessionDir, "layout.json"), "非法 session 路径");

      if (!(await exists(dataPath))) {
        throw new Error("非法 session 路径");
      }

      try {
        const existing = await lstat(filePath);
        if (existing.isSymbolicLink()) {
          throw new Error("非法 session 路径");
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }

      await writeFile(filePath, `${JSON.stringify(layout, null, 2)}\n`, "utf8");
      return { id: sessionId, title: readTitle(layout, sessionId) };
    },

    async listTemplates() {
      if (!(await exists(templatesDir))) return [];

      const entries = await readdir(templatesDir, { withFileTypes: true });
      const templates = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

        const filePath = ensureInside(templatesDir, path.join(templatesDir, entry.name), "非法模板路径");
        const template = await readJson(filePath);
        templates.push({ id: entry.name, title: readTitle(template, entry.name.replace(/\.json$/, "")) });
      }

      return templates.sort((a, b) => a.id.localeCompare(b.id));
    },

    async loadTemplate(templateId) {
      if (!isTemplateFileName(templateId)) {
        throw new Error("非法模板路径");
      }

      const filePath = ensureInside(templatesDir, path.join(templatesDir, templateId), "非法模板路径");
      return readJson(filePath);
    },

    async saveTemplate(template) {
      await mkdir(templatesDir, { recursive: true });

      const id = safeTemplateFileName(template?.name);
      const filePath = ensureInside(templatesDir, path.join(templatesDir, id), "非法模板路径");
      try {
        const existing = await lstat(filePath);
        if (existing.isSymbolicLink()) {
          throw new Error("非法模板路径");
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }

      await writeFile(filePath, `${JSON.stringify(template, null, 2)}\n`, "utf8");

      return { id, title: readTitle(template, id.replace(/\.json$/, "")) };
    },

    async resolveAsset(sessionId, assetPath) {
      return sessionAssetPath(rootDir, sessionId, assetPath);
    }
  };
}
