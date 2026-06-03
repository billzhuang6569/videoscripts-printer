import { DEFAULT_SORT_DIRECTION, SORT_DIRECTIONS } from "./schema.js";
import { clampColumnWidth, clampRowHeight, createLayout } from "./layout.js";

function cloneLayout(layout) {
  return {
    ...layout,
    paper: { ...layout.paper },
    table: { ...layout.table },
    organization: { ...(layout.organization ?? {}) },
    columns: layout.columns.map((column) => ({ ...column })),
    missingColumns: (layout.missingColumns ?? []).map((column) => ({ ...column }))
  };
}

function isLayoutField(state, fieldId) {
  return typeof fieldId === "string" && state.layout.columns.some((column) => column.fieldId === fieldId);
}

function updateColumn(state, fieldId, updater) {
  const currentColumn = state.layout.columns.find((item) => item.fieldId === fieldId);
  if (!currentColumn) return state;
  const nextColumn = { ...currentColumn };
  updater(nextColumn);
  if (
    Object.is(nextColumn.label, currentColumn.label) &&
    Object.is(nextColumn.type, currentColumn.type) &&
    Object.is(nextColumn.visible, currentColumn.visible) &&
    Object.is(nextColumn.width, currentColumn.width)
  ) {
    return state;
  }

  const layout = cloneLayout(state.layout);
  const column = layout.columns.find((item) => item.fieldId === fieldId);
  Object.assign(column, nextColumn);
  return { ...state, layout };
}

export function createInitialState(session, template) {
  return {
    session,
    layout: createLayout(session.fields, template),
    selectedRowId: null
  };
}

export function renameColumn(state, fieldId, label) {
  return updateColumn(state, fieldId, (column) => {
    column.label = label;
  });
}

export function setColumnType(state, fieldId, type) {
  return updateColumn(state, fieldId, (column) => {
    column.type = type;
  });
}

export function resizeColumn(state, fieldId, width) {
  return updateColumn(state, fieldId, (column) => {
    column.width = clampColumnWidth(width);
  });
}

export function toggleColumnVisible(state, fieldId) {
  return updateColumn(state, fieldId, (column) => {
    column.visible = !column.visible;
  });
}

export function setRowHeight(state, rowHeight) {
  const nextRowHeight = clampRowHeight(rowHeight);
  if (Object.is(state.layout.table.rowHeight, nextRowHeight)) return state;

  const layout = cloneLayout(state.layout);
  layout.table.rowHeight = nextRowHeight;
  return { ...state, layout };
}

export function moveColumn(state, fieldId, nextIndex) {
  const currentIndex = state.layout.columns.findIndex((column) => column.fieldId === fieldId);
  if (currentIndex === -1) return state;

  const boundedIndex = Math.min(state.layout.columns.length - 1, Math.max(0, Number(nextIndex) || 0));
  if (currentIndex === boundedIndex) return state;

  const layout = cloneLayout(state.layout);
  const [column] = layout.columns.splice(currentIndex, 1);
  layout.columns.splice(boundedIndex, 0, column);
  return { ...state, layout };
}

export function setGroupByField(state, fieldId) {
  const nextFieldId = isLayoutField(state, fieldId) ? fieldId : "";
  if ((state.layout.organization?.groupByFieldId ?? "") === nextFieldId) return state;

  const layout = cloneLayout(state.layout);
  layout.organization.groupByFieldId = nextFieldId;
  return { ...state, layout };
}

export function setSortByField(state, fieldId) {
  const nextFieldId = isLayoutField(state, fieldId) ? fieldId : "";
  if ((state.layout.organization?.sortByFieldId ?? "") === nextFieldId) return state;

  const layout = cloneLayout(state.layout);
  layout.organization.sortByFieldId = nextFieldId;
  return { ...state, layout };
}

export function setSortDirection(state, direction) {
  const nextDirection = SORT_DIRECTIONS.includes(direction) ? direction : DEFAULT_SORT_DIRECTION;
  if ((state.layout.organization?.sortDirection ?? DEFAULT_SORT_DIRECTION) === nextDirection) return state;

  const layout = cloneLayout(state.layout);
  layout.organization.sortDirection = nextDirection;
  return { ...state, layout };
}

export function toTemplate(layout, name = layout.name) {
  return {
    name,
    paper: { ...layout.paper },
    table: { ...layout.table },
    organization: {
      groupByFieldId: layout.organization?.groupByFieldId ?? "",
      sortByFieldId: layout.organization?.sortByFieldId ?? "",
      sortDirection: layout.organization?.sortDirection ?? DEFAULT_SORT_DIRECTION
    },
    columns: layout.columns.map(({ fieldId, label, type, visible, width }) => ({
      fieldId,
      label,
      type,
      visible,
      width
    }))
  };
}
