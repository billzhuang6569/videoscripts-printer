import { listSessions, listTemplates, loadSession, loadTemplate, saveTemplate } from "./api.js";
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
  const disabledUp = index === 0 ? " disabled" : "";
  const disabledDown = index === state.layout.columns.length - 1 ? " disabled" : "";

  return `
    <article class="field-row" data-field-row="${escapeAttr(column.fieldId)}">
      <label class="visibility-toggle" title="显示字段">
        <input type="checkbox" data-field-visible="${escapeAttr(column.fieldId)}"${column.visible ? " checked" : ""}>
        <span aria-hidden="true"></span>
      </label>
      <div class="field-main">
        <label class="field-label">
          <span>标签</span>
          <input type="text" value="${escapeAttr(column.label)}" data-field-label="${escapeAttr(column.fieldId)}">
        </label>
        <div class="field-meta">
          <span class="field-type">${escapeHtml(type)}</span>
          <label>
            <span>宽</span>
            <input type="number" min="${MIN_COLUMN_WIDTH}" max="${MAX_COLUMN_WIDTH}" step="4" value="${escapeAttr(column.width)}" data-field-width="${escapeAttr(column.fieldId)}">
          </label>
        </div>
      </div>
      <div class="move-controls" aria-label="移动字段">
        <button type="button" data-move-field="${escapeAttr(column.fieldId)}" data-move-direction="-1"${disabledUp} title="上移">↑</button>
        <button type="button" data-move-field="${escapeAttr(column.fieldId)}" data-move-direction="1"${disabledDown} title="下移">↓</button>
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
  els.previewTitle.textContent = state.session.title ?? selectedTitle(sessions, currentSessionId);
  els.previewPaper.textContent = `${state.layout.paper.size} · ${state.layout.paper.orientation === "landscape" ? "横向" : "纵向"}`;
  els.printSurface.innerHTML = renderPrintTable(state.session, state.layout, currentSessionId);
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

async function loadCurrentSelection() {
  if (!currentSessionId || !currentTemplateId) return;
  setStatus("正在加载预览...");
  const [session, template] = await Promise.all([loadSession(currentSessionId), loadTemplate(currentTemplateId)]);
  state = createInitialState(session, template);
  render();
  setStatus("预览已就绪", "success");
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

  setStatus("正在保存模板...");
  const saved = await saveTemplate(toTemplate(state.layout, name.trim()));
  currentTemplateId = saved.id;
  await refreshLists();
  els.templateSelect.value = currentTemplateId;
  setStatus("模板已保存", "success");
}

function bindEvents() {
  els.sessionSelect.addEventListener("change", async (event) => {
    currentSessionId = event.target.value;
    await loadCurrentSelection().catch(handleError);
  });

  els.templateSelect.addEventListener("change", async (event) => {
    currentTemplateId = event.target.value;
    await loadCurrentSelection().catch(handleError);
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
    }
  });

  els.fieldList.addEventListener("change", (event) => {
    const fieldId = event.target.dataset.fieldVisible;
    if (!fieldId) return;
    state = toggleColumnVisible(state, fieldId);
    render();
  });

  els.fieldList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-move-field]");
    if (!button) return;

    const currentIndex = state.layout.columns.findIndex((column) => column.fieldId === button.dataset.moveField);
    state = moveColumn(state, button.dataset.moveField, currentIndex + Number(button.dataset.moveDirection));
    render();
  });

  els.saveTemplate.addEventListener("click", () => {
    handleSaveTemplate().catch(handleError);
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
