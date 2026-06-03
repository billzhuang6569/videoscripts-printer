import { listSessions, listTemplates, loadSession, loadTemplate, saveTemplate } from "./api.js";
import { columnWidthValue, isDragContextActive, savedTemplateState, shouldApplyLoad } from "./app-helpers.js";
import { MAX_COLUMN_WIDTH, MAX_ROW_HEIGHT, MIN_COLUMN_WIDTH, MIN_ROW_HEIGHT } from "./schema.js";
import {
  createInitialState,
  moveColumn,
  renameColumn,
  resizeColumn,
  setRowHeight,
  toTemplate,
  toggleColumnVisible
} from "./state.js";
import { renderPrintTable } from "./render.js";

const selectors = {
  appShell: "[data-app-shell]",
  fieldCount: "[data-field-count]",
  fieldList: "[data-field-list]",
  missingWarning: "[data-missing-warning]",
  missingWarningText: "[data-missing-warning-text]",
  orientationButton: "[data-orientation-button]",
  paperSheet: "[data-paper-sheet]",
  previewPaper: "[data-preview-paper]",
  previewTitle: "[data-preview-title]",
  print: "[data-print]",
  printSurface: "[data-print-surface]",
  rowHeightOutput: "[data-row-height-output]",
  rowHeightSlider: "[data-row-height-slider]",
  saveTemplate: "[data-save-template]",
  sessionSelect: "[data-session-select]",
  statusText: "[data-status-text]",
  templateSelect: "[data-template-select]"
};

const els = {};
let sessions = [];
let templates = [];
let currentSessionId = "";
let currentTemplateId = "";
let state = null;
let loadSequence = 0;
let draggedFieldId = "";
let fieldPointerDrag = null;

function queryElements() {
  for (const [key, selector] of Object.entries(selectors)) {
    els[key] = document.querySelector(selector);
  }
}

function setStatus(message, tone = "neutral") {
  if (!els.statusText) return;
  els.statusText.textContent = message;
  els.statusText.dataset.tone = tone;
}

function optionMarkup(items) {
  return items.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.title)}</option>`).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function selectedTitle(items, id) {
  return items.find((item) => item.id === id)?.title ?? id;
}

function fieldById(fieldId) {
  return state?.session?.fields?.find((field) => field.id === fieldId) ?? null;
}

function selectedSessionId() {
  return els.sessionSelect?.value || currentSessionId;
}

function selectedTemplateId() {
  return els.templateSelect?.value || currentTemplateId;
}

function withLoadedSelection(nextState, sessionId, templateId) {
  return {
    ...nextState,
    sessionId,
    templateId
  };
}

function setOrientation(orientation) {
  if (!state || state.layout.paper.orientation === orientation) return;
  state = {
    ...state,
    layout: {
      ...state.layout,
      paper: { ...state.layout.paper, orientation }
    }
  };
  updatePrintPageStyle();
  render();
}

function createFieldRow(column, index) {
  const field = fieldById(column.fieldId);
  const type = field?.type ?? column.type ?? "text";
  const visibilityLabel = column.label || field?.name || column.fieldId;

  return `
    <article class="field-row" data-field-row="${escapeAttr(column.fieldId)}">
      <button class="drag-handle" type="button" data-drag-field="${escapeAttr(column.fieldId)}" aria-label="拖动排序：${escapeAttr(visibilityLabel)}" title="拖动排序">
        <span aria-hidden="true"></span>
      </button>
      <label class="visibility-toggle" title="显示字段">
        <input type="checkbox" aria-label="显示字段：${escapeAttr(visibilityLabel)}" data-field-visible="${escapeAttr(column.fieldId)}"${column.visible ? " checked" : ""}>
        <span aria-hidden="true"></span>
      </label>
      <div class="field-main">
        <label class="field-label">
          <span>标签</span>
          <input type="text" value="${escapeAttr(column.label)}" data-field-label="${escapeAttr(column.fieldId)}">
        </label>
        <div class="field-meta">
          <span class="field-type">${escapeHtml(type)}</span>
          <label class="width-slider">
            <span>宽度 <output data-field-width-output="${escapeAttr(column.fieldId)}">${escapeHtml(column.width)} px</output></span>
            <input type="range" min="${MIN_COLUMN_WIDTH}" max="${MAX_COLUMN_WIDTH}" step="4" value="${escapeAttr(column.width)}" data-field-width="${escapeAttr(column.fieldId)}">
          </label>
        </div>
      </div>
    </article>
  `;
}

function renderFieldControls() {
  els.fieldCount.textContent = `${state.layout.columns.length}`;
  els.fieldList.innerHTML = state.layout.columns.map(createFieldRow).join("");
}

function renderMissingWarning() {
  const missingColumns = state.layout.missingColumns ?? [];
  els.missingWarning.hidden = missingColumns.length === 0;
  els.missingWarningText.textContent =
    missingColumns.length === 0
      ? ""
      : missingColumns.map((column) => `${column.label} (${column.fieldId})`).join("、");
}

function renderOrientationButtons() {
  document.querySelectorAll(selectors.orientationButton).forEach((button) => {
    const selected = button.dataset.orientationButton === state.layout.paper.orientation;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderPreview() {
  els.paperSheet.dataset.orientation = state.layout.paper.orientation;
  document.documentElement.dataset.paperOrientation = state.layout.paper.orientation;
  const sessionId = state.sessionId ?? currentSessionId;
  els.previewTitle.textContent = state.session.title ?? selectedTitle(sessions, sessionId);
  els.previewPaper.textContent = `${state.layout.paper.size} · ${state.layout.paper.orientation === "landscape" ? "横向" : "纵向"}`;
  els.printSurface.innerHTML = renderPrintTable(state.session, state.layout, sessionId);
}

function renderRowHeight() {
  const rowHeight = state.layout.table.rowHeight;
  els.rowHeightSlider.min = String(MIN_ROW_HEIGHT);
  els.rowHeightSlider.max = String(MAX_ROW_HEIGHT);
  els.rowHeightSlider.value = String(rowHeight);
  els.rowHeightOutput.value = `${rowHeight} px`;
}

function render() {
  if (!state) return;
  updatePrintPageStyle();
  renderOrientationButtons();
  renderRowHeight();
  renderMissingWarning();
  renderFieldControls();
  renderPreview();
}

function updatePrintPageStyle() {
  if (!state) return;

  let style = document.querySelector("style[data-print-page-size]");
  if (!style) {
    style = document.createElement("style");
    style.dataset.printPageSize = "true";
    document.head.append(style);
  }
  style.textContent = `@media print { @page { size: A4 ${state.layout.paper.orientation}; margin: 10mm; } }`;
}

async function loadCurrentSelection(sessionId = selectedSessionId(), templateId = selectedTemplateId()) {
  const requestId = ++loadSequence;
  if (!sessionId || !templateId) return;
  setStatus("正在加载预览...");

  try {
    const [session, template] = await Promise.all([loadSession(sessionId), loadTemplate(templateId)]);
    if (!shouldApplyLoad(requestId, loadSequence)) return;

    currentSessionId = sessionId;
    currentTemplateId = templateId;
    state = withLoadedSelection(createInitialState(session, template), sessionId, templateId);
    render();
    setStatus("预览已就绪", "success");
  } catch (error) {
    if (shouldApplyLoad(requestId, loadSequence)) handleError(error);
  }
}

async function refreshLists() {
  [sessions, templates] = await Promise.all([listSessions(), listTemplates()]);
  els.sessionSelect.innerHTML = optionMarkup(sessions);
  els.templateSelect.innerHTML = optionMarkup(templates);

  currentSessionId = currentSessionId && sessions.some((item) => item.id === currentSessionId) ? currentSessionId : sessions[0]?.id ?? "";
  currentTemplateId =
    currentTemplateId && templates.some((item) => item.id === currentTemplateId) ? currentTemplateId : templates[0]?.id ?? "";

  els.sessionSelect.value = currentSessionId;
  els.templateSelect.value = currentTemplateId;
}

async function handleSaveTemplate() {
  if (!state) return;

  const currentName = state.layout.name || selectedTitle(templates, currentTemplateId) || "未命名模板";
  const name = window.prompt("保存模板名称", currentName);
  if (!name || name.trim().length === 0) return;
  const trimmedName = name.trim();

  setStatus("正在保存模板...");
  const saved = await saveTemplate(toTemplate(state.layout, trimmedName));
  currentTemplateId = saved.id;
  state = savedTemplateState(state, saved, trimmedName);
  await refreshLists();
  els.templateSelect.value = currentTemplateId;
  setStatus("模板已保存", "success");
}

function syncColumnWidthControl(fieldId) {
  const column = state?.layout.columns.find((item) => item.fieldId === fieldId);
  const input = [...(els.fieldList?.querySelectorAll("[data-field-width]") ?? [])].find(
    (item) => item.dataset.fieldWidth === fieldId
  );
  const output = [...(els.fieldList?.querySelectorAll("[data-field-width-output]") ?? [])].find(
    (item) => item.dataset.fieldWidthOutput === fieldId
  );
  if (column && input) input.value = columnWidthValue(state, fieldId);
  if (column && output) output.textContent = `${columnWidthValue(state, fieldId)} px`;
}

function clearDropMarkers() {
  els.fieldList?.querySelectorAll(".is-drop-before, .is-drop-after, .is-dragging").forEach((row) => {
    row.classList.remove("is-drop-before", "is-drop-after", "is-dragging");
  });
}

function dropTargetFromEvent(event) {
  const row = event.target?.closest?.("[data-field-row]");
  if (!row || row.dataset.fieldRow === draggedFieldId) return null;
  return row;
}

function dropTargetFromPoint(event) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const row = element?.closest("[data-field-row]");
  if (!row || row.dataset.fieldRow === draggedFieldId) return null;
  return row;
}

function dropPlacement(event, row) {
  if (!row) return "after";
  const rect = row.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
}

function dropIndexForTarget(targetFieldId, placement) {
  const columnsWithoutDragged = state.layout.columns.filter((column) => column.fieldId !== draggedFieldId);
  if (!targetFieldId) return columnsWithoutDragged.length;

  const targetIndex = columnsWithoutDragged.findIndex((column) => column.fieldId === targetFieldId);
  if (targetIndex === -1) return columnsWithoutDragged.length;
  return placement === "after" ? targetIndex + 1 : targetIndex;
}

function renderDropMarker(event) {
  clearDropMarkers();
  const target = dropTargetFromPoint(event) ?? dropTargetFromEvent(event);
  const dragged = els.fieldList.querySelector(`[data-field-row="${CSS.escape(draggedFieldId)}"]`);
  dragged?.classList.add("is-dragging");

  if (!target) return;
  target.classList.add(dropPlacement(event, target) === "after" ? "is-drop-after" : "is-drop-before");
}

function handleFieldPointerDown(event) {
  const handle = event.target.closest("[data-drag-field]");
  if (!state || !handle) return;

  event.preventDefault();
  draggedFieldId = handle.dataset.dragField;
  fieldPointerDrag = {
    fieldId: draggedFieldId,
    pointerId: event.pointerId
  };
  handle.setPointerCapture?.(event.pointerId);
  document.body.classList.add("is-field-dragging");
  renderDropMarker(event);

  window.addEventListener("pointermove", handleFieldPointerMove);
  window.addEventListener("pointerup", handleFieldPointerUp);
  window.addEventListener("pointercancel", handleFieldPointerCancel);
}

function handleFieldPointerMove(event) {
  if (!state || !fieldPointerDrag || event.pointerId !== fieldPointerDrag.pointerId) return;
  event.preventDefault();
  renderDropMarker(event);
}

function handleFieldPointerUp(event) {
  if (!state || !fieldPointerDrag || event.pointerId !== fieldPointerDrag.pointerId) return;
  event.preventDefault();

  const target = dropTargetFromPoint(event) ?? dropTargetFromEvent(event);
  const targetFieldId = target?.dataset.fieldRow ?? "";
  const nextIndex = dropIndexForTarget(targetFieldId, dropPlacement(event, target));
  state = moveColumn(state, draggedFieldId, nextIndex);
  stopFieldPointerDrag();
  render();
}

function handleFieldPointerCancel() {
  stopFieldPointerDrag();
}

function stopFieldPointerDrag() {
  window.removeEventListener("pointermove", handleFieldPointerMove);
  window.removeEventListener("pointerup", handleFieldPointerUp);
  window.removeEventListener("pointercancel", handleFieldPointerCancel);
  document.body.classList.remove("is-field-dragging");
  fieldPointerDrag = null;
  draggedFieldId = "";
  clearDropMarkers();
}

function handleFieldKeyboardMove(event) {
  const handle = event.target.closest("[data-drag-field]");
  if (!state || !handle || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;

  event.preventDefault();
  const fieldId = handle.dataset.dragField;
  const currentIndex = state.layout.columns.findIndex((column) => column.fieldId === fieldId);
  const nextIndexByKey = {
    ArrowUp: currentIndex - 1,
    ArrowDown: currentIndex + 1,
    Home: 0,
    End: state.layout.columns.length - 1
  };

  state = moveColumn(state, fieldId, nextIndexByKey[event.key]);
  render();
  els.fieldList.querySelector(`[data-drag-field="${CSS.escape(fieldId)}"]`)?.focus();
}

function handleResizePointerDown(event) {
  const handle = event.target.closest("[data-resize-field]");
  if (!state || !handle) return;

  const fieldId = handle.dataset.resizeField;
  const column = state.layout.columns.find((item) => item.fieldId === fieldId);
  if (!column) return;

  event.preventDefault();
  const startX = event.clientX;
  const startWidth = Number(column.width);
  const startingWidth = Number.isFinite(startWidth) ? startWidth : MIN_COLUMN_WIDTH;
  const dragContext = {
    sessionId: state.sessionId,
    templateId: state.templateId
  };

  function onMove(moveEvent) {
    if (!isDragContextActive(state, dragContext)) {
      stopDrag();
      return;
    }
    state = resizeColumn(state, fieldId, startingWidth + moveEvent.clientX - startX);
    renderPreview();
    syncColumnWidthControl(fieldId);
  }

  function stopDrag() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", stopDrag);
    window.removeEventListener("pointercancel", stopDrag);
    renderFieldControls();
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", stopDrag);
  window.addEventListener("pointercancel", stopDrag);
}

function bindEvents() {
  els.sessionSelect.addEventListener("change", async (event) => {
    await loadCurrentSelection(event.target.value, selectedTemplateId());
  });

  els.templateSelect.addEventListener("change", async (event) => {
    await loadCurrentSelection(selectedSessionId(), event.target.value);
  });

  document.querySelectorAll(selectors.orientationButton).forEach((button) => {
    button.addEventListener("click", () => setOrientation(button.dataset.orientationButton));
  });

  els.rowHeightSlider.addEventListener("input", (event) => {
    state = setRowHeight(state, Number(event.target.value));
    renderRowHeight();
    renderPreview();
  });

  els.fieldList.addEventListener("input", (event) => {
    const labelFieldId = event.target.dataset.fieldLabel;
    const widthFieldId = event.target.dataset.fieldWidth;
    if (labelFieldId) {
      state = renameColumn(state, labelFieldId, event.target.value);
      renderPreview();
    }
    if (widthFieldId) {
      state = resizeColumn(state, widthFieldId, Number(event.target.value));
      renderPreview();
      syncColumnWidthControl(widthFieldId);
    }
  });

  els.fieldList.addEventListener("change", (event) => {
    const fieldId = event.target.dataset.fieldVisible;
    if (!fieldId) return;
    state = toggleColumnVisible(state, fieldId);
    render();
  });

  els.fieldList.addEventListener("pointerdown", handleFieldPointerDown);
  els.fieldList.addEventListener("keydown", handleFieldKeyboardMove);

  els.saveTemplate.addEventListener("click", () => {
    handleSaveTemplate().catch(handleError);
  });

  els.printSurface.addEventListener("pointerdown", handleResizePointerDown);

  els.print.addEventListener("click", () => window.print());
}

function handleError(error) {
  setStatus(error?.message || "操作失败", "danger");
}

async function boot() {
  queryElements();
  bindEvents();
  await refreshLists();
  if (!currentSessionId || !currentTemplateId) {
    setStatus("缺少 session 或模板", "danger");
    return;
  }
  await loadCurrentSelection();
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    boot().catch(handleError);
  });
}
