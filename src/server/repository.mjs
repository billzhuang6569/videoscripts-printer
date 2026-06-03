import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
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

export function safeTemplateFileName(name) {
  const alias = NAME_ALIASES.get(name);
  const raw = alias ?? (typeof name === "string" ? name : "");
  const slug = raw
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return `${slug || "template"}.json`;
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

export function sessionAssetPath(rootDir, sessionId, assetPath) {
  if (!isNonEmptyString(sessionId) || path.isAbsolute(sessionId)) {
    throw new Error("非法 session 路径");
  }
  if (!isNonEmptyString(assetPath) || path.isAbsolute(assetPath)) {
    throw new Error("非法图片路径");
  }

  const importsDir = path.join(rootDir, "imports");
  const sessionDir = ensureInside(importsDir, path.join(importsDir, sessionId), "非法 session 路径");
  return ensureInside(sessionDir, path.join(sessionDir, assetPath), "非法图片路径");
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
      if (!isNonEmptyString(sessionId) || path.isAbsolute(sessionId)) {
        throw new Error("非法 session 路径");
      }

      const filePath = ensureInside(importsDir, path.join(importsDir, sessionId, "data.json"), "非法 session 路径");
      return readJson(filePath);
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
      if (!isNonEmptyString(templateId) || path.isAbsolute(templateId)) {
        throw new Error("非法模板路径");
      }

      const filePath = ensureInside(templatesDir, path.join(templatesDir, templateId), "非法模板路径");
      return readJson(filePath);
    },

    async saveTemplate(template) {
      await mkdir(templatesDir, { recursive: true });

      const id = safeTemplateFileName(template?.name);
      const filePath = ensureInside(templatesDir, path.join(templatesDir, id), "非法模板路径");
      await writeFile(filePath, `${JSON.stringify(template, null, 2)}\n`, "utf8");

      return { id, title: readTitle(template, id.replace(/\.json$/, "")) };
    },

    resolveAsset(sessionId, assetPath) {
      return sessionAssetPath(rootDir, sessionId, assetPath);
    }
  };
}
