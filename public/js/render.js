import { visibleColumns } from "./layout.js";

const EMPTY = "";

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

function renderTags(value) {
  const tags = normalizeList(value).filter((tag) => tag != null && String(tag).length > 0);
  if (tags.length === 0) return EMPTY;

  return `<div class="cell-tags">${tags.map((tag) => `<span class="cell-tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
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
    const captionMarkup = caption ? `<figcaption class="print-image-caption">${escapeHtml(caption)}</figcaption>` : EMPTY;

    return `<figure class="print-image-frame"><img class="print-image print-image-contain" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">${captionMarkup}</figure>`;
  });

  return `<div class="print-image-list">${renderedImages.join("")}</div>`;
}

export function renderCellValue(type, value, sessionId) {
  if (type === "multiSelect") return renderTags(value);
  if (type === "image") return renderImages(value, sessionId);
  return `<span class="cell-text">${escapeHtml(value)}</span>`;
}

function fieldTypesById(session) {
  return new Map((session.fields ?? []).map((field) => [field.id, field.type]));
}

function columnWidth(column) {
  const width = Number(column.width);
  return Number.isFinite(width) && width > 0 ? width : null;
}

export function renderPrintTable(session, layout, sessionId) {
  const columns = visibleColumns(layout);
  const fieldTypes = fieldTypesById(session);
  const rowHeight = Number(layout?.table?.rowHeight);
  const rowStyle = Number.isFinite(rowHeight) && rowHeight > 0 ? ` style="height: ${rowHeight}px;"` : EMPTY;
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

  const rows = (session.rows ?? [])
    .map((row) => {
      const cells = columns
        .map((column) => {
          const type = fieldTypes.get(column.fieldId) ?? column.type ?? "text";
          const value = row.cells?.[column.fieldId];
          return `<td data-field="${escapeHtml(column.fieldId)}">${renderCellValue(type, value, sessionId)}</td>`;
        })
        .join("");

      return `<tr data-row-id="${escapeHtml(row.id)}"${rowStyle}>${cells}</tr>`;
    })
    .join("");

  return `<table class="print-table${avoidBreakClass}" data-session-id="${escapeHtml(sessionId)}"><colgroup>${colgroup}</colgroup><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}
