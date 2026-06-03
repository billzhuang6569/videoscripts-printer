import path from "node:path";
import {
  FIELD_TYPES,
  MAX_COLUMN_WIDTH,
  MAX_ROW_HEIGHT,
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT,
  PAPER_ORIENTATIONS,
  PAPER_SIZES
} from "../shared/schema.mjs";

const DEFAULT_ALLOWED_IMAGE_EXTENSIONS = Object.freeze([".svg", ".png", ".jpg", ".jpeg", ".webp"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRenderablePrimitive(value) {
  return value === null || value === undefined || ["string", "number", "boolean"].includes(typeof value);
}

function normalizeAllowedExtensions(extensions) {
  return new Set(
    extensions.map((extension) => {
      const normalized = extension.toLowerCase();
      return normalized.startsWith(".") ? normalized : `.${normalized}`;
    })
  );
}

function normalizeSafeRelativePath(value) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  if (path.posix.isAbsolute(value)) return null;

  const normalized = path.posix.normalize(value);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) return null;

  return normalized;
}

function hasAllowedExtension(value, allowedExtensions) {
  return allowedExtensions.has(path.posix.extname(value).toLowerCase());
}

export function validateSessionData(data, options = {}) {
  const errors = [];
  const allowedImageExtensions = normalizeAllowedExtensions(
    options.allowedImageExtensions ?? DEFAULT_ALLOWED_IMAGE_EXTENSIONS
  );
  const imageExists = typeof options.imageExists === "function" ? options.imageExists : null;

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

    if (typeof field.id !== "string" || field.id.length === 0) {
      errors.push(`第 ${index + 1} 个字段缺少 id`);
    }
    if (fieldIds.has(field.id)) errors.push(`字段 id 重复：${field.id}`);
    fieldIds.add(field.id);

    if (typeof field.name !== "string" || field.name.length === 0) {
      errors.push(`字段 ${field.id} 缺少 name`);
    }
    if (!FIELD_TYPES.includes(field.type)) {
      errors.push(`字段 ${field.id} 使用了不支持的字段类型：${field.type}`);
    }

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

      if (type === "text" && !isRenderablePrimitive(value)) {
        errors.push(`第 ${rowIndex + 1} 行字段 ${fieldId} 必须是可渲染的文本值（字符串、数字、布尔值或空值）`);
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
          const normalizedPath = isPlainObject(image) ? normalizeSafeRelativePath(image.path) : null;
          if (!normalizedPath) {
            errors.push(`第 ${rowIndex + 1} 行字段 ${fieldId} 的第 ${imageIndex + 1} 张图片路径必须是 session 内的相对路径`);
            return;
          }

          if (!hasAllowedExtension(normalizedPath, allowedImageExtensions)) {
            errors.push(
              `第 ${rowIndex + 1} 行字段 ${fieldId} 的第 ${imageIndex + 1} 张图片路径必须使用可显示的图片扩展名`
            );
            return;
          }

          if (imageExists && !imageExists(normalizedPath)) {
            errors.push(`第 ${rowIndex + 1} 行字段 ${fieldId} 的第 ${imageIndex + 1} 张图片不存在：${normalizedPath}`);
          }
        });
      }
    });
  });

  return { errors };
}

export function validateTemplate(template, options = {}) {
  const errors = [];

  if (!isPlainObject(template)) return { errors: ["模板必须是对象"] };

  if (typeof template.name !== "string" || template.name.length === 0) errors.push("模板缺少 name");
  if (!isPlainObject(template.paper)) errors.push("模板缺少 paper 对象");
  if (!isPlainObject(template.table)) errors.push("模板缺少 table 对象");
  if (!Array.isArray(template.columns)) errors.push("模板 columns 必须是数组");
  if (errors.length > 0) return { errors };

  if (!PAPER_SIZES.includes(template.paper.size)) errors.push(`不支持的纸张尺寸：${template.paper.size}`);
  if (!PAPER_ORIENTATIONS.includes(template.paper.orientation)) {
    errors.push(`不支持的纸张方向：${template.paper.orientation}`);
  }
  if (
    !Number.isFinite(template.table.rowHeight) ||
    template.table.rowHeight < MIN_ROW_HEIGHT ||
    template.table.rowHeight > MAX_ROW_HEIGHT
  ) {
    errors.push(`行高必须在 ${MIN_ROW_HEIGHT} 到 ${MAX_ROW_HEIGHT} 之间`);
  }

  const seen = new Set();
  const fieldIds = options.fieldIds ? new Set(options.fieldIds) : null;
  template.columns.forEach((column, index) => {
    if (!isPlainObject(column)) {
      errors.push(`第 ${index + 1} 列必须是对象`);
      return;
    }

    if (typeof column.fieldId !== "string" || column.fieldId.length === 0) {
      errors.push(`第 ${index + 1} 列缺少 fieldId`);
    }
    if (
      fieldIds &&
      typeof column.fieldId === "string" &&
      column.fieldId.length > 0 &&
      !fieldIds.has(column.fieldId)
    ) {
      errors.push(`第 ${index + 1} 列引用了 fields 中不存在的字段：${column.fieldId}`);
    }
    if (seen.has(column.fieldId)) errors.push(`模板重复引用字段：${column.fieldId}`);
    seen.add(column.fieldId);

    if (typeof column.label !== "string" || column.label.length === 0) {
      errors.push(`第 ${index + 1} 列缺少 label`);
    }
    if (typeof column.visible !== "boolean") errors.push(`第 ${index + 1} 列 visible 必须是布尔值`);
    if (!Number.isFinite(column.width) || column.width < MIN_COLUMN_WIDTH || column.width > MAX_COLUMN_WIDTH) {
      errors.push(`第 ${index + 1} 列宽度必须在 ${MIN_COLUMN_WIDTH} 到 ${MAX_COLUMN_WIDTH} 之间`);
    }
  });

  return { errors };
}
