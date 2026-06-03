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
  if (!state.layout.columns.some((item) => item.fieldId === fieldId)) return state;

  const layout = cloneLayout(state.layout);
  const column = layout.columns.find((item) => item.fieldId === fieldId);
  updater(column);
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
  const layout = cloneLayout(state.layout);
  layout.table.rowHeight = clampRowHeight(rowHeight);
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
    columns: layout.columns.map(({ fieldId, label, visible, width }) => ({
      fieldId,
      label,
      visible,
      width
    }))
  };
}
