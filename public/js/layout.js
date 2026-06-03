import {
  DEFAULT_ROW_HEIGHT,
  MAX_COLUMN_WIDTH,
  MAX_ROW_HEIGHT,
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT
} from "../../src/shared/schema.mjs";

const DEFAULT_PAPER = Object.freeze({ size: "A4", orientation: "landscape" });

export function clampColumnWidth(width) {
  const numeric = Number(width);
  if (!Number.isFinite(numeric)) return MIN_COLUMN_WIDTH;
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, numeric));
}

export function clampRowHeight(rowHeight) {
  const numeric = Number(rowHeight);
  if (!Number.isFinite(numeric)) return MIN_ROW_HEIGHT;
  return Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, numeric));
}

function defaultWidthForField(field) {
  return field.type === "image" ? 260 : 180;
}

export function applyTemplateToFields(fields, template = {}) {
  const byFieldId = new Map(fields.map((field) => [field.id, field]));
  const used = new Set();
  const columns = [];

  for (const templateColumn of template.columns ?? []) {
    const field = byFieldId.get(templateColumn.fieldId);
    if (!field || used.has(field.id)) continue;

    used.add(field.id);
    columns.push({
      fieldId: field.id,
      type: field.type,
      label: typeof templateColumn.label === "string" && templateColumn.label.length > 0 ? templateColumn.label : field.name,
      visible: templateColumn.visible !== false,
      width: clampColumnWidth(templateColumn.width)
    });
  }

  for (const field of fields) {
    if (used.has(field.id)) continue;

    columns.push({
      fieldId: field.id,
      type: field.type,
      label: field.name,
      visible: true,
      width: clampColumnWidth(defaultWidthForField(field))
    });
  }

  return columns;
}

export function createLayout(fields, template = {}) {
  const paper = template.paper ?? DEFAULT_PAPER;
  const table = template.table ?? {};

  return {
    name: template.name ?? "",
    paper: {
      size: paper.size ?? DEFAULT_PAPER.size,
      orientation: paper.orientation ?? DEFAULT_PAPER.orientation
    },
    table: {
      ...table,
      rowHeight: clampRowHeight(table.rowHeight ?? DEFAULT_ROW_HEIGHT),
      avoidRowPageBreak: table.avoidRowPageBreak !== false
    },
    columns: applyTemplateToFields(fields, template)
  };
}

export function visibleColumns(layout) {
  return layout.columns.filter((column) => column.visible);
}
