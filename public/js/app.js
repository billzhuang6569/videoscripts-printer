import {
  listSessions,
  listTemplates,
  loadSession,
  loadSessionLayout,
  loadTemplate,
  saveSessionData,
  saveSessionLayout,
  saveTemplate
} from "./api.js";
import { columnWidthValue, isDragContextActive, savedTemplateState, shouldApplyLoad } from "./app-helpers.js";
import { FIELD_TYPES, MAX_COLUMN_WIDTH, MAX_ROW_HEIGHT, MIN_COLUMN_WIDTH, MIN_ROW_HEIGHT } from "./schema.js";
import {
  createInitialState,
  moveColumn,
  renameColumn,
  resizeColumn,
  setColumnType,
  setGroupByField,
  setRowHeight,
  setRowHeightMode,
  setSortByField,
  setSortDirection,
  toTemplate,
  toggleColumnVisible,
  updateCellValue
} from "./state.js";
import { renderPrintTable } from "./render.js";

const selectors = {
  appShell: "[data-app-shell]",
  cellEditor: "[data-cell-editor]",
  cellEditorCancel: "[data-cell-editor-cancel]",
  cellEditorClose: "[data-cell-editor-close]",
  cellEditorSave: "[data-cell-editor-save]",
  cellEditorTextarea: "[data-cell-editor-textarea]",
  cellEditorTitle: "[data-cell-editor-title]",
  cellTagEditor: "[data-cell-tag-editor]",
  cellTextEditor: "[data-cell-text-editor]",
  fieldCount: "[data-field-count]",
  fieldList: "[data-field-list]",
  groupField: "[data-group-field]",
  missingWarning: "[data-missing-warning]",
  missingWarningText: "[data-missing-warning-text]",
  orientationButton: "[data-orientation-button]",
  paperSheet: "[data-paper-sheet]",
  previewPaper: "[data-preview-paper]",
  previewTitle: "[data-preview-title]",
  print: "[data-print]",
  printSurface: "[data-print-surface]",
  rowHeightModeButton: "[data-row-height-mode-button]",
  rowHeightOutput: "[data-row-height-output]",
  rowHeightSlider: "[data-row-height-slider]",
  saveTemplate: "[data-save-template]",
  sessionSelect: "[data-session-select]",
  sortDirectionButton: "[data-sort-direction-button]",
  sortField: "[data-sort-field]",
  statusText: "[data-status-text]",
  templateCancel: "[data-template-cancel]",
  templateConfirm: "[data-template-confirm]",
  templateDialog: "[data-template-dialog]",
  templateNameInput: "[data-template-name-input]",
  templateSelect: "[data-template-select]",
  tagEditorOptions: "[data-tag-editor-options]",
  tagEditorSearch: "[data-tag-editor-search]",
  tagEditorSelected: "[data-tag-editor-selected]"
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
let cellEditorState = null;
let sessionLayoutSaveTimer = 0;
let sessionDataSaveTimer = 0;
let templateNameResolver = null;

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

function columnTitle(column) {
  return column.label || fieldById(column.fieldId)?.name || column.fieldId;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

function normalizeTagList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter((item) => item.length > 0);
  if (value == null || value === "") return [];
  return String(value)
    .split(/\s*\/\s*/u)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function rowById(rowId) {
  return state?.session?.rows?.find((row) => row.id === rowId) ?? null;
}

function columnByFieldId(fieldId) {
  return state?.layout?.columns?.find((column) => column.fieldId === fieldId) ?? null;
}

function cellType(fieldId) {
  return columnByFieldId(fieldId)?.type ?? fieldById(fieldId)?.type ?? "text";
}

function cellValue(rowId, fieldId) {
  return rowById(rowId)?.cells?.[fieldId];
}

function textEditorValue(type, value) {
  if (type === "image") {
    return normalizeList(value)
      .map((image) => (image && typeof image === "object" ? image.caption ?? "" : ""))
      .join("\n");
  }
  if (Array.isArray(value)) return value.join("\n");
  return String(value ?? "");
}

function tagOptionsForField(fieldId) {
  const options = new Set();
  for (const row of state?.session?.rows ?? []) {
    normalizeTagList(row.cells?.[fieldId]).forEach((tag) => {
      const value = String(tag ?? "").trim();
      if (value.length > 0) options.add(value);
    });
  }
  return [...options].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function selectedTags() {
  return cellEditorState?.tags ?? [];
}

function selectedSessionId() {
  return els.sessionSelect?.value || currentSessionId;
}

function selectedTemplateId() {
  return els.templateSelect?.value || currentTemplateId;
}

function queryParam(name) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
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
  scheduleSessionLayoutSave();
}

function createFieldRow(column, index) {
  const field = fieldById(column.fieldId);
  const visibilityLabel = column.label || field?.name || column.fieldId;
  const typeOptions = FIELD_TYPES.map((fieldType) => {
    const label = { text: "文本", multiSelect: "标签", image: "图片", todo: "TODO" }[fieldType] ?? fieldType;
    return `<option value="${escapeAttr(fieldType)}"${column.type === fieldType ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");

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
          <label class="field-type-field">
            <span>类型</span>
            <select class="field-type" data-field-type="${escapeAttr(column.fieldId)}" aria-label="字段类型：${escapeAttr(visibilityLabel)}">
              ${typeOptions}
            </select>
          </label>
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

function organizationOptions(emptyLabel, selectedFieldId) {
  const empty = `<option value=""${selectedFieldId ? "" : " selected"}>${escapeHtml(emptyLabel)}</option>`;
  const options = state.layout.columns
    .map((column) => {
      const selected = column.fieldId === selectedFieldId ? " selected" : "";
      return `<option value="${escapeAttr(column.fieldId)}"${selected}>${escapeHtml(columnTitle(column))}</option>`;
    })
    .join("");

  return `${empty}${options}`;
}

function renderOrganizationControls() {
  const organization = state.layout.organization ?? {};

  els.groupField.innerHTML = organizationOptions("不分组", organization.groupByFieldId ?? "");
  els.sortField.innerHTML = organizationOptions("不排序", organization.sortByFieldId ?? "");

  document.querySelectorAll(selectors.sortDirectionButton).forEach((button) => {
    const selected = button.dataset.sortDirectionButton === (organization.sortDirection ?? "asc");
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.disabled = !organization.sortByFieldId;
  });
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
  const rowHeightMode = state.layout.table.rowHeightMode ?? "fixed";
  els.rowHeightSlider.min = String(MIN_ROW_HEIGHT);
  els.rowHeightSlider.max = String(MAX_ROW_HEIGHT);
  els.rowHeightSlider.value = String(rowHeight);
  els.rowHeightSlider.disabled = rowHeightMode === "auto";
  els.rowHeightOutput.value = rowHeightMode === "auto" ? "自动" : `${rowHeight} px`;
  document.querySelectorAll(selectors.rowHeightModeButton).forEach((button) => {
    const selected = button.dataset.rowHeightModeButton === rowHeightMode;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function render() {
  if (!state) return;
  updatePrintPageStyle();
  renderOrientationButtons();
  renderRowHeight();
  renderMissingWarning();
  renderOrganizationControls();
  renderFieldControls();
  renderPreview();
}

function syncUrlSelection() {
  if (typeof window === "undefined" || !currentSessionId) return;

  const url = new URL(window.location.href);
  url.searchParams.set("session", currentSessionId);
  if (currentTemplateId) url.searchParams.set("template", currentTemplateId);
  window.history.replaceState({}, "", url);
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

async function loadCurrentSelection(sessionId = selectedSessionId(), templateId = selectedTemplateId(), options = {}) {
  const preferSessionLayout = options.preferSessionLayout ?? true;
  const requestId = ++loadSequence;
  if (!sessionId || !templateId) return;
  setStatus("正在加载预览...");

  try {
    const [session, template, savedLayout] = await Promise.all([
      loadSession(sessionId),
      loadTemplate(templateId),
      loadSessionLayout(sessionId)
    ]);
    if (!shouldApplyLoad(requestId, loadSequence)) return;

    currentSessionId = sessionId;
    currentTemplateId = templateId;
    const layoutSource = preferSessionLayout && savedLayout ? savedLayout : template;
    state = withLoadedSelection(createInitialState(session, layoutSource), sessionId, templateId);
    render();
    syncUrlSelection();
    if (!preferSessionLayout) scheduleSessionLayoutSave();
    setStatus("预览已就绪", "success");
  } catch (error) {
    if (shouldApplyLoad(requestId, loadSequence)) handleError(error);
  }
}

async function refreshLists() {
  [sessions, templates] = await Promise.all([listSessions(), listTemplates()]);
  els.sessionSelect.innerHTML = optionMarkup(sessions);
  els.templateSelect.innerHTML = optionMarkup(templates);

  const requestedSessionId = queryParam("session");
  const requestedTemplateId = queryParam("template");

  currentSessionId =
    requestedSessionId && sessions.some((item) => item.id === requestedSessionId)
      ? requestedSessionId
      : currentSessionId && sessions.some((item) => item.id === currentSessionId)
        ? currentSessionId
        : sessions[0]?.id ?? "";
  currentTemplateId =
    requestedTemplateId && templates.some((item) => item.id === requestedTemplateId)
      ? requestedTemplateId
      : currentTemplateId && templates.some((item) => item.id === currentTemplateId)
        ? currentTemplateId
        : templates[0]?.id ?? "";

  els.sessionSelect.value = currentSessionId;
  els.templateSelect.value = currentTemplateId;
}

async function handleSaveTemplate() {
  if (!state) return;

  const currentName = state.layout.name || selectedTitle(templates, currentTemplateId) || "未命名模板";
  const name = await requestTemplateName(currentName);
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

function requestTemplateName(defaultName) {
  if (!els.templateDialog || !els.templateNameInput) return Promise.resolve("");

  return new Promise((resolve) => {
    templateNameResolver = resolve;
    els.templateNameInput.value = defaultName;
    if (typeof els.templateDialog.showModal === "function") {
      els.templateDialog.showModal();
    } else {
      els.templateDialog.removeAttribute("hidden");
    }
    window.setTimeout(() => {
      els.templateNameInput.focus();
      els.templateNameInput.select();
    }, 0);
  });
}

function closeTemplateNameDialog(value) {
  const resolver = templateNameResolver;
  templateNameResolver = null;

  if (els.templateDialog?.open) {
    els.templateDialog.close();
  } else {
    els.templateDialog?.setAttribute("hidden", "");
  }

  resolver?.(value);
}

function scheduleSessionLayoutSave() {
  if (!state?.sessionId) return;

  window.clearTimeout(sessionLayoutSaveTimer);
  sessionLayoutSaveTimer = window.setTimeout(async () => {
    try {
      await saveSessionLayout(state.sessionId, toTemplate(state.layout, state.layout.name || state.session.title || "本次打印排版"));
    } catch (error) {
      handleError(error);
    }
  }, 360);
}

function scheduleSessionDataSave() {
  if (!state?.sessionId) return;

  window.clearTimeout(sessionDataSaveTimer);
  sessionDataSaveTimer = window.setTimeout(async () => {
    try {
      await saveSessionData(state.sessionId, state.session);
      setStatus("内容已保存", "success");
    } catch (error) {
      handleError(error);
    }
  }, 420);
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

function positionCellEditor(anchor) {
  const rect = anchor.getBoundingClientRect();
  const editorWidth = 340;
  const editorHeight = els.cellEditor.getBoundingClientRect().height || 260;
  const left = Math.min(window.innerWidth - editorWidth - 12, Math.max(12, rect.left));
  const preferredTop = rect.bottom + 8;
  const top = Math.min(window.innerHeight - editorHeight - 12, Math.max(12, preferredTop));

  els.cellEditor.style.left = `${left}px`;
  els.cellEditor.style.top = `${Math.max(12, top)}px`;
}

function renderSelectedTags() {
  const tags = selectedTags();
  els.tagEditorSelected.innerHTML =
    tags.length === 0
      ? `<span class="tag-editor-empty">未选择</span>`
      : tags
          .map(
            (tag) =>
              `<button type="button" class="tag-editor-pill" data-tag-remove="${escapeAttr(tag)}">${escapeHtml(tag)}<span aria-hidden="true">×</span></button>`
          )
          .join("");
}

function renderTagOptions() {
  if (!cellEditorState) return;
  const query = els.tagEditorSearch.value.trim();
  const selected = new Set(selectedTags());
  const allOptions = tagOptionsForField(cellEditorState.fieldId);
  const visibleOptions = allOptions.filter((tag) => !query || tag.toLowerCase().includes(query.toLowerCase()));
  const canCreate = query.length > 0 && !allOptions.some((tag) => tag.toLowerCase() === query.toLowerCase());

  const optionMarkup = visibleOptions
    .map((tag) => {
      const isSelected = selected.has(tag);
      return `<button type="button" class="tag-option${isSelected ? " is-selected" : ""}" data-tag-option="${escapeAttr(tag)}"><span class="cell-tag">${escapeHtml(tag)}</span>${isSelected ? "<span>已选</span>" : ""}</button>`;
    })
    .join("");
  const createMarkup = canCreate
    ? `<button type="button" class="tag-option tag-option-create" data-tag-create="${escapeAttr(query)}">创建 <span class="cell-tag">${escapeHtml(query)}</span></button>`
    : "";

  els.tagEditorOptions.innerHTML = `${optionMarkup}${createMarkup}` || `<div class="tag-editor-empty">没有匹配选项</div>`;
}

function renderTagEditor() {
  renderSelectedTags();
  renderTagOptions();
}

function toggleEditorTag(tag) {
  if (!cellEditorState) return;
  const value = String(tag ?? "").trim();
  if (value.length === 0) return;

  const tags = selectedTags();
  cellEditorState.tags = tags.includes(value) ? tags.filter((item) => item !== value) : [...tags, value];
  renderTagEditor();
}

function removeEditorTag(tag) {
  if (!cellEditorState) return;
  cellEditorState.tags = selectedTags().filter((item) => item !== tag);
  renderTagEditor();
}

function openCellEditor(cell) {
  if (!state || !cell) return;

  const rowId = cell.dataset.rowId;
  const fieldId = cell.dataset.field;
  const type = cellType(fieldId);
  const value = cellValue(rowId, fieldId);
  const column = columnByFieldId(fieldId);

  if (type === "image" && normalizeList(value).length === 0) {
    setStatus("图片字段当前没有可编辑附件", "neutral");
    return;
  }

  cellEditorState = {
    rowId,
    fieldId,
    type,
    tags: type === "multiSelect" ? normalizeTagList(value) : []
  };

  els.cellEditorTitle.textContent = columnTitle(column ?? { fieldId });
  els.cellEditor.hidden = false;
  els.cellTextEditor.hidden = type === "multiSelect";
  els.cellTagEditor.hidden = type !== "multiSelect";

  if (type === "multiSelect") {
    els.tagEditorSearch.value = "";
    renderTagEditor();
    window.setTimeout(() => els.tagEditorSearch.focus(), 0);
  } else {
    els.cellEditorTextarea.value = textEditorValue(type, value);
    els.cellEditorTextarea.placeholder = type === "image" ? "每行对应一张图片的说明文字，支持 Markdown" : "支持 Markdown";
    window.setTimeout(() => {
      els.cellEditorTextarea.focus();
      els.cellEditorTextarea.select();
    }, 0);
  }

  positionCellEditor(cell);
}

function closeCellEditor() {
  cellEditorState = null;
  els.cellEditor.hidden = true;
}

function valueFromCellEditor() {
  const { rowId, fieldId, type } = cellEditorState;
  if (type === "multiSelect") {
    return fieldById(fieldId)?.type === "multiSelect" ? selectedTags() : selectedTags().join(" / ");
  }
  if (type === "image") {
    const captions = els.cellEditorTextarea.value.split(/\r?\n/u);
    return normalizeList(cellValue(rowId, fieldId)).map((image, index) =>
      image && typeof image === "object" ? { ...image, caption: captions[index] ?? "" } : image
    );
  }
  return els.cellEditorTextarea.value;
}

function saveCellEditor() {
  if (!state || !cellEditorState) return;
  const { rowId, fieldId } = cellEditorState;
  state = updateCellValue(state, rowId, fieldId, valueFromCellEditor());
  closeCellEditor();
  renderPreview();
  scheduleSessionDataSave();
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
  scheduleSessionLayoutSave();
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
  scheduleSessionLayoutSave();
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
    scheduleSessionLayoutSave();
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
    await loadCurrentSelection(selectedSessionId(), event.target.value, { preferSessionLayout: false });
  });

  document.querySelectorAll(selectors.orientationButton).forEach((button) => {
    button.addEventListener("click", () => setOrientation(button.dataset.orientationButton));
  });

  els.rowHeightSlider.addEventListener("input", (event) => {
    state = setRowHeight(state, Number(event.target.value));
    renderRowHeight();
    renderPreview();
    scheduleSessionLayoutSave();
  });

  document.querySelectorAll(selectors.rowHeightModeButton).forEach((button) => {
    button.addEventListener("click", () => {
      state = setRowHeightMode(state, button.dataset.rowHeightModeButton);
      renderRowHeight();
      renderPreview();
      scheduleSessionLayoutSave();
    });
  });

  els.groupField.addEventListener("change", (event) => {
    state = setGroupByField(state, event.target.value);
    renderPreview();
    scheduleSessionLayoutSave();
  });

  els.sortField.addEventListener("change", (event) => {
    state = setSortByField(state, event.target.value);
    renderOrganizationControls();
    renderPreview();
    scheduleSessionLayoutSave();
  });

  document.querySelectorAll(selectors.sortDirectionButton).forEach((button) => {
    button.addEventListener("click", () => {
      state = setSortDirection(state, button.dataset.sortDirectionButton);
      renderOrganizationControls();
      renderPreview();
      scheduleSessionLayoutSave();
    });
  });

  els.fieldList.addEventListener("input", (event) => {
    const labelFieldId = event.target.dataset.fieldLabel;
    const widthFieldId = event.target.dataset.fieldWidth;
    if (labelFieldId) {
      state = renameColumn(state, labelFieldId, event.target.value);
      renderPreview();
      scheduleSessionLayoutSave();
    }
    if (widthFieldId) {
      state = resizeColumn(state, widthFieldId, Number(event.target.value));
      renderPreview();
      syncColumnWidthControl(widthFieldId);
      scheduleSessionLayoutSave();
    }
  });

  els.fieldList.addEventListener("change", (event) => {
    const fieldId = event.target.dataset.fieldVisible;
    const typeFieldId = event.target.dataset.fieldType;
    if (fieldId) {
      state = toggleColumnVisible(state, fieldId);
      render();
      scheduleSessionLayoutSave();
    }
    if (typeFieldId) {
      state = setColumnType(state, typeFieldId, event.target.value);
      renderPreview();
      scheduleSessionLayoutSave();
    }
  });

  els.fieldList.addEventListener("pointerdown", handleFieldPointerDown);
  els.fieldList.addEventListener("keydown", handleFieldKeyboardMove);

  els.saveTemplate.addEventListener("click", () => {
    handleSaveTemplate().catch(handleError);
  });

  els.templateConfirm?.addEventListener("click", () => {
    closeTemplateNameDialog(els.templateNameInput.value);
  });

  els.templateCancel?.addEventListener("click", () => {
    closeTemplateNameDialog("");
  });

  els.templateNameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      closeTemplateNameDialog(els.templateNameInput.value);
    }
  });

  els.templateDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeTemplateNameDialog("");
  });

  els.templateDialog?.addEventListener("close", () => {
    if (templateNameResolver) closeTemplateNameDialog("");
  });

  els.printSurface.addEventListener("pointerdown", handleResizePointerDown);

  els.printSurface.addEventListener("click", (event) => {
    if (event.target.closest("[data-resize-field]")) return;
    const cell = event.target.closest("td[data-row-id][data-field]");
    if (!cell) return;
    openCellEditor(cell);
  });

  els.cellEditorSave.addEventListener("click", saveCellEditor);
  els.cellEditorCancel.addEventListener("click", closeCellEditor);
  els.cellEditorClose.addEventListener("click", closeCellEditor);

  els.cellEditorTextarea.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      saveCellEditor();
    }
    if (event.key === "Escape") closeCellEditor();
  });

  els.tagEditorSearch.addEventListener("input", renderTagOptions);
  els.tagEditorSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      toggleEditorTag(els.tagEditorSearch.value);
      els.tagEditorSearch.value = "";
      renderTagEditor();
    }
    if (event.key === "Escape") closeCellEditor();
  });

  els.tagEditorSelected.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-tag-remove]");
    if (removeButton) removeEditorTag(removeButton.dataset.tagRemove);
  });

  els.tagEditorOptions.addEventListener("click", (event) => {
    const option = event.target.closest("[data-tag-option], [data-tag-create]");
    if (!option) return;
    toggleEditorTag(option.dataset.tagOption ?? option.dataset.tagCreate);
    if (option.dataset.tagCreate) els.tagEditorSearch.value = "";
    renderTagEditor();
  });

  document.addEventListener("pointerdown", (event) => {
    if (els.cellEditor.hidden) return;
    if (event.target.closest("[data-cell-editor]") || event.target.closest("td[data-row-id][data-field]")) return;
    closeCellEditor();
  });

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
