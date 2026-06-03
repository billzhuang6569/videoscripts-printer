import { clampColumnWidth, clampRowHeight, createLayout } from "./layout.js";

function cloneLayout(layout) {
  return {
    ...layout,
    paper: { ...layout.paper },
    table: { ...layout.table },
    columns: layout.columns.map((column) => ({ ...column })),
    missingColumns: (layout.missingColumns ?? []).map((column) => ({ ...column }))
  };
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

export function toTemplate(layout, name = layout.name) {
  return {
    name,
    paper: { ...layout.paper },
    table: { ...layout.table },
    columns: layout.columns.map(({ fieldId, label, type, visible, width }) => ({
      fieldId,
      label,
      type,
      visible,
      width
    }))
  };
}
