import {
  DEFAULT_PAPER_ORIENTATION,
  DEFAULT_PAPER_SIZE,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_SORT_DIRECTION,
  FIELD_TYPES,
  MAX_COLUMN_WIDTH,
  MAX_ROW_HEIGHT,
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT,
  PAPER_ORIENTATIONS,
  PAPER_SIZES,
  SORT_DIRECTIONS
} from "./schema.js";

const DEFAULT_PAPER = Object.freeze({
  size: DEFAULT_PAPER_SIZE,
  orientation: DEFAULT_PAPER_ORIENTATION
});

export function clampColumnWidth(width) {
  const numeric = Number(width);
  if (!Number.isFinite(numeric)) return MIN_COLUMN_WIDTH;
  return Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, numeric)));
}

export function clampRowHeight(rowHeight) {
  const numeric = Number(rowHeight);
  if (!Number.isFinite(numeric)) return MIN_ROW_HEIGHT;
  return Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, numeric));
}

function defaultWidthForField(field) {
  if (field.type === "todo") return 220;
  return field.type === "image" ? 260 : 180;
}

function normalizeFieldType(type, fallback = "text") {
  return FIELD_TYPES.includes(type) ? type : fallback;
}

function normalizePaper(paper = {}) {
  return {
    size: PAPER_SIZES.includes(paper.size) ? paper.size : DEFAULT_PAPER.size,
    orientation: PAPER_ORIENTATIONS.includes(paper.orientation) ? paper.orientation : DEFAULT_PAPER.orientation
  };
}

export function normalizeOrganization(organization = {}, fields = []) {
  const fieldIds = new Set(fields.map((field) => field.id));
  const groupByFieldId =
    typeof organization.groupByFieldId === "string" && fieldIds.has(organization.groupByFieldId)
      ? organization.groupByFieldId
      : "";
  const sortByFieldId =
    typeof organization.sortByFieldId === "string" && fieldIds.has(organization.sortByFieldId)
      ? organization.sortByFieldId
      : "";
  const sortDirection = SORT_DIRECTIONS.includes(organization.sortDirection)
    ? organization.sortDirection
    : DEFAULT_SORT_DIRECTION;

  return {
    groupByFieldId,
    sortByFieldId,
    sortDirection
  };
}

function missingTemplateColumns(fields, template = {}) {
  const fieldIds = new Set(fields.map((field) => field.id));

  return (template.columns ?? [])
    .filter((templateColumn) => !fieldIds.has(templateColumn.fieldId))
    .map((templateColumn) => ({
      fieldId: templateColumn.fieldId,
      label:
        typeof templateColumn.label === "string" && templateColumn.label.length > 0
          ? templateColumn.label
          : templateColumn.fieldId,
      visible: templateColumn.visible !== false,
      width: clampColumnWidth(templateColumn.width)
    }));
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
      type: normalizeFieldType(templateColumn.type, field.type),
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
  const table = template.table ?? {};

  return {
    name: template.name ?? "",
    paper: normalizePaper(template.paper),
    table: {
      ...table,
      rowHeight: clampRowHeight(table.rowHeight ?? DEFAULT_ROW_HEIGHT),
      avoidRowPageBreak: table.avoidRowPageBreak !== false
    },
    organization: normalizeOrganization(template.organization, fields),
    columns: applyTemplateToFields(fields, template),
    missingColumns: missingTemplateColumns(fields, template)
  };
}

export function visibleColumns(layout) {
  return layout.columns.filter((column) => column.visible);
}
