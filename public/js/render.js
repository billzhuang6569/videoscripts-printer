import { visibleColumns } from "./layout.js";

const EMPTY = "";
const EMPTY_GROUP_LABEL = "未填写";
const GROUP_COUNT_SUFFIX = "条";
const NATURAL_COLLATOR = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base"
});
const COLOR_MARKERS = Object.freeze({
  "🟦": "blue",
  "🟩": "green",
  "🟧": "orange",
  "🟪": "purple",
  "🟨": "yellow"
});
const COLOR_MARKER_PATTERN = /[🟦🟩🟧🟪🟨]/u;

function escapeHtml(value) {
  return String(value ?? EMPTY)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function encodeAssetPath(assetPath) {
  return encodeURIComponent(String(assetPath));
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === EMPTY) return [];
  return [value];
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === EMPTY) return [];
  return String(value)
    .split(/\s*\/\s*/u)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function renderInlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gu, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  html = html.replace(/`([^`]+)`/gu, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/gu, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/gu, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/gu, "<em>$1</em>");
  return html;
}

function renderMarkdown(value) {
  const lines = String(value ?? EMPTY).replace(/\r\n?/gu, "\n").split("\n");
  const blocks = [];
  let listItems = [];
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push(`<ul>${listItems.join("")}</ul>`);
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    const todoMatch = line.match(/^(?:[-*]\s*)?\[( |x|X)\]\s+(.+)$/u);
    if (todoMatch) {
      flushParagraph();
      const checkedClass = todoMatch[1].toLowerCase() === "x" ? " is-checked" : EMPTY;
      listItems.push(
        `<li class="cell-todo-item${checkedClass}"><span class="cell-todo-box" aria-hidden="true"></span><span class="cell-todo-text">${renderInlineMarkdown(todoMatch[2])}</span></li>`
      );
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/u);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(`<li>${renderInlineMarkdown(bulletMatch[1])}</li>`);
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/u);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length + 2;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  if (blocks.length === 0) return EMPTY;
  return `<div class="cell-markdown">${blocks.join("")}</div>`;
}

function renderTags(value) {
  const tags = normalizeTags(value).filter((tag) => tag != null && String(tag).length > 0);
  if (tags.length === 0) return EMPTY;

  return `<div class="cell-tags">${tags.map((tag) => `<span class="cell-tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function splitTagParts(value) {
  return String(value ?? EMPTY)
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function renderColorTag(label, marker) {
  const color = COLOR_MARKERS[marker] ?? "neutral";
  return `<span class="cell-tag cell-tag-${color}">${escapeHtml(label)}</span>`;
}

function renderColorTaggedText(value) {
  const text = String(value ?? EMPTY);
  if (!COLOR_MARKER_PATTERN.test(text)) return null;

  const tags = [];
  const tokenPattern = /([🟦🟩🟧🟪🟨]+)\s*([^🟦🟩🟧🟪🟨]*)/gu;
  let match;

  while ((match = tokenPattern.exec(text)) !== null) {
    const markers = [...match[1]];
    const parts = splitTagParts(match[2]);
    if (parts.length === 0) continue;

    parts.forEach((part, index) => {
      tags.push(renderColorTag(part, markers[index] ?? markers[0]));
    });
  }

  if (tags.length === 0) return `<span class="cell-text">${escapeHtml(text.replace(/[🟦🟩🟧🟪🟨]/gu, "").trim())}</span>`;
  return `<div class="cell-tags cell-tags-colored">${tags.join("")}</div>`;
}

function renderImages(value, sessionId) {
  const images = normalizeList(value).filter(
    (image) => image && typeof image === "object" && typeof image.path === "string" && image.path.length > 0
  );
  if (images.length === 0) return EMPTY;

  const encodedSessionId = encodeURIComponent(String(sessionId ?? EMPTY));
  const renderedImages = images.map((image) => {
    const caption = typeof image.caption === "string" ? image.caption : EMPTY;
    const src = `/assets/${encodedSessionId}/${encodeAssetPath(image.path)}`;
    const alt = caption || image.path;
    const captionMarkup = caption ? `<figcaption class="print-image-caption">${renderInlineMarkdown(caption)}</figcaption>` : EMPTY;

    return `<figure class="print-image-frame"><img class="print-image print-image-contain" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">${captionMarkup}</figure>`;
  });

  return `<div class="print-image-list">${renderedImages.join("")}</div>`;
}

export function renderCellValue(type, value, sessionId) {
  if (type === "multiSelect") return renderTags(value);
  if (type === "image") return renderImages(value, sessionId);
  const colorTaggedText = renderColorTaggedText(value);
  if (colorTaggedText) return colorTaggedText;
  return renderMarkdown(value);
}

function fieldTypesById(session) {
  return new Map((session.fields ?? []).map((field) => [field.id, field.type]));
}

function columnWidth(column) {
  const width = Number(column.width);
  return Number.isFinite(width) && width > 0 ? width : null;
}

function stripTodoMarker(value) {
  return String(value ?? EMPTY).replace(/^(?:[-*]\s*)?\[(?: |x|X)\]\s*/u, "");
}

function displayPartFromValue(value) {
  if (value == null) return EMPTY;
  if (typeof value === "object") {
    if (typeof value.caption === "string" && value.caption.length > 0) return value.caption;
    if (typeof value.path === "string" && value.path.length > 0) return value.path;
    return EMPTY;
  }
  return stripTodoMarker(value);
}

function displayValue(value) {
  const parts = normalizeList(value)
    .map(displayPartFromValue)
    .map((part) => String(part).replace(/[🟦🟩🟧🟪🟨]/gu, "").trim())
    .filter((part) => part.length > 0);

  return parts.join(" / ");
}

function organizationColumn(layout, fieldId) {
  if (!fieldId) return null;
  return layout.columns.find((column) => column.fieldId === fieldId) ?? null;
}

function compareRows(left, right, sortColumn, sortDirection) {
  const leftValue = displayValue(left.row.cells?.[sortColumn.fieldId]);
  const rightValue = displayValue(right.row.cells?.[sortColumn.fieldId]);
  const direction = sortDirection === "desc" ? -1 : 1;
  const compared = NATURAL_COLLATOR.compare(leftValue, rightValue);

  if (compared !== 0) return compared * direction;
  return left.index - right.index;
}

function arrangedRowGroups(session, layout) {
  const organization = layout.organization ?? {};
  const sortColumn = organizationColumn(layout, organization.sortByFieldId);
  const groupColumn = organizationColumn(layout, organization.groupByFieldId);
  const rows = (session.rows ?? []).map((row, index) => ({ row, index }));

  if (sortColumn) {
    rows.sort((left, right) => compareRows(left, right, sortColumn, organization.sortDirection));
  }

  if (!groupColumn) {
    return [{ key: EMPTY, label: EMPTY, rows: rows.map((item) => item.row), grouped: false }];
  }

  const groups = [];
  const groupsByKey = new Map();

  for (const item of rows) {
    const label = displayValue(item.row.cells?.[groupColumn.fieldId]) || EMPTY_GROUP_LABEL;
    const key = label;
    let group = groupsByKey.get(key);
    if (!group) {
      group = { key, label, rows: [], grouped: true };
      groupsByKey.set(key, group);
      groups.push(group);
    }
    group.rows.push(item.row);
  }

  return groups;
}

function renderGroupHeader(group, columnCount) {
  return `<tr class="print-group-row" data-group-key="${escapeHtml(group.key)}"><th scope="rowgroup" colspan="${Math.max(1, columnCount)}"><span class="print-group-label">${escapeHtml(group.label)}</span><span class="print-group-count">${group.rows.length} ${GROUP_COUNT_SUFFIX}</span></th></tr>`;
}

function renderDataRow(row, columns, fieldTypes, rowStyle, sessionId) {
  const cells = columns
    .map((column) => {
      const type = column.type ?? fieldTypes.get(column.fieldId) ?? "text";
      const value = row.cells?.[column.fieldId];
      return `<td class="editable-cell" data-row-id="${escapeHtml(row.id)}" data-field="${escapeHtml(column.fieldId)}" data-cell-type="${escapeHtml(type)}">${renderCellValue(type, value, sessionId)}</td>`;
    })
    .join("");

  return `<tr data-row-id="${escapeHtml(row.id)}"${rowStyle}>${cells}</tr>`;
}

export function renderPrintTable(session, layout, sessionId) {
  const columns = visibleColumns(layout);
  const fieldTypes = fieldTypesById(session);
  const rowHeight = Number(layout?.table?.rowHeight);
  const autoRowHeight = layout?.table?.rowHeightMode === "auto";
  const rowStyle = !autoRowHeight && Number.isFinite(rowHeight) && rowHeight > 0 ? ` style="height: ${rowHeight}px;"` : EMPTY;
  const avoidBreakClass = layout?.table?.avoidRowPageBreak === false ? EMPTY : " print-table-avoid-row-break";

  const colgroup = columns
    .map((column) => {
      const width = columnWidth(column);
      const style = width ? ` style="width: ${width}px;"` : EMPTY;
      return `<col data-field="${escapeHtml(column.fieldId)}"${style}>`;
    })
    .join("");

  const headers = columns
    .map(
      (column) =>
        `<th scope="col" data-field="${escapeHtml(column.fieldId)}"><span class="print-header-label">${escapeHtml(column.label)}</span><span class="resize-handle" data-resize-field="${escapeHtml(column.fieldId)}" aria-hidden="true"></span></th>`
    )
    .join("");

  const rows = arrangedRowGroups(session, layout)
    .map((group) => {
      const groupHeader = group.grouped ? renderGroupHeader(group, columns.length) : EMPTY;
      const dataRows = group.rows.map((row) => renderDataRow(row, columns, fieldTypes, rowStyle, sessionId)).join("");
      return `${groupHeader}${dataRows}`;
    })
    .join("");

  return `<table class="print-table${avoidBreakClass}" data-session-id="${escapeHtml(sessionId)}"><colgroup>${colgroup}</colgroup><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}
