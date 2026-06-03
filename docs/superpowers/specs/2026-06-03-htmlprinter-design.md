# HTMLprinter Design Spec

Date: 2026-06-03

## Purpose

HTMLprinter is a local web app for printing shooting script tables. It is designed to work with a future SKILL-based import layer:

```text
SKILL -> structured JSON session -> frontend print preview -> browser print / PDF
```

The first version prioritizes reliable A4 print layout. It is not a content editor. Users can adjust layout and field presentation, but they cannot edit the imported script content in the web app.

## Product Scope

### In Scope

- Import a local print session containing `data.json` and local image assets.
- Render a final-print-style preview for shooting script tables.
- Support fields commonly used in production scripts:
  - `镜头号`
  - `旁白`
  - `画面内容`
  - `画面参考/分镜`
  - `备注`
  - `标签`
- Support field types:
  - text
  - multi-select tags
  - image attachments
- Allow layout-only adjustments:
  - reorder fields
  - rename displayed field labels
  - show or hide fields
  - manually drag column widths
  - globally adjust row height
  - switch A4 landscape / portrait
  - select, save, and overwrite shared templates
- Make image columns resize with the column width and row height.
- Print through the browser print dialog, including direct printing and saving as PDF.
- Keep each row together as much as possible during pagination.

### Out of Scope For V1

- Editing imported cell content.
- Editing imported field types.
- Direct Feishu authentication or API access from the frontend.
- Downloading Feishu attachments inside the frontend.
- Cloud sync, user accounts, permissions, or multi-user collaboration.
- Complex per-row custom layout rules.

## Recommended Architecture

Use a local lightweight service plus a frontend print renderer.

The local service handles filesystem tasks that a pure static page cannot do reliably:

- list available import sessions
- read `data.json`
- serve local image assets from each session
- list shared templates
- save shared templates into the project workspace
- validate session and template files

The frontend handles layout and printing:

- session selection / import
- template selection
- paper settings
- field visibility, order, labels, and widths
- row height
- print preview
- browser print command

This is preferred over a pure static HTML page because browser security restrictions make stable local image loading and workspace template saving awkward. It is also preferred over splitting the importer into the first implementation because the future Feishu/SKILL layer can be added independently.

## Workspace Structure

Recommended project-owned folders:

```text
imports/
  2026-06-03-client-project/
    data.json
    assets/
      shot-001-ref.jpg
      shot-002-ref.jpg

templates/
  shot-script/
    balanced-landscape.json
    storyboard-heavy.json
    narration-heavy.json
```

Each print task gets its own session folder under `imports/`. Assets are stored inside that session so multiple imported jobs do not overwrite or mix files.

Templates are shared project files. Because this is an internal tool, saving templates in the code workspace is intentional: one person can tune a template, and the team can reuse the same template.

## Session Data Format

`data.json` describes content and field types only. It does not store column widths or other layout decisions.

Example:

```json
{
  "title": "某项目拍摄脚本表",
  "source": {
    "type": "feishu-bitable",
    "name": "脚本表",
    "generatedAt": "2026-06-03T10:00:00+08:00"
  },
  "fields": [
    { "id": "shot_no", "name": "镜头号", "type": "text" },
    { "id": "voiceover", "name": "旁白", "type": "text" },
    { "id": "visual", "name": "画面内容", "type": "text" },
    { "id": "reference", "name": "画面参考/分镜", "type": "image" },
    { "id": "notes", "name": "备注", "type": "text" },
    { "id": "tags", "name": "标签", "type": "multiSelect" }
  ],
  "rows": [
    {
      "id": "row_001",
      "cells": {
        "shot_no": "01",
        "voiceover": "开场旁白……",
        "visual": "人物进入画面，镜头缓慢推进",
        "reference": [
          { "path": "assets/shot-001-ref.jpg", "caption": "参考图" }
        ],
        "notes": "注意光线",
        "tags": ["外景", "重点"]
      }
    }
  ]
}
```

Field rules:

- `field.id` is stable and unique within the file.
- `field.name` is the source display name.
- `field.type` must be one of `text`, `multiSelect`, or `image`.
- `rows[].cells` keys should match declared field IDs.
- Text values are rendered as plain text.
- Multi-select values are arrays of strings.
- Image values are arrays of image objects with a local relative `path` and optional `caption`.
- Image paths are relative to the session folder.

## Template Format

Templates describe how a session should be displayed. They do not include row content.

Example:

```json
{
  "name": "均衡横版脚本表",
  "paper": {
    "size": "A4",
    "orientation": "landscape"
  },
  "table": {
    "rowHeight": 96,
    "density": "normal",
    "avoidRowPageBreak": true
  },
  "columns": [
    { "fieldId": "shot_no", "label": "镜头号", "visible": true, "width": 64 },
    { "fieldId": "voiceover", "label": "旁白", "visible": true, "width": 220 },
    { "fieldId": "visual", "label": "画面内容", "visible": true, "width": 260 },
    { "fieldId": "reference", "label": "画面参考/分镜", "visible": true, "width": 260 },
    { "fieldId": "notes", "label": "备注", "visible": true, "width": 150 },
    { "fieldId": "tags", "label": "标签", "visible": true, "width": 120 }
  ]
}
```

Template rules:

- `paper.size` is `A4` in V1.
- `paper.orientation` is `landscape` or `portrait`.
- `table.rowHeight` controls global row height.
- `table.avoidRowPageBreak` defaults to `true`.
- `columns` defines template order.
- `columns[].label` is the printed display label and can differ from the imported field name.
- `columns[].width` is a layout value stored in the template, not in imported data.
- Templates may reference missing fields; the UI should warn and let the user ignore or reset those columns.

Default templates:

- Balanced landscape: the default first view, close to a normal shooting script table.
- Storyboard-heavy: a wider image/reference column.
- Narration-heavy: wider voiceover and visual text columns.

## Frontend UI

### Top Toolbar

Controls:

- session selector / import action
- template selector
- paper orientation toggle
- save template
- save as new template
- print button

The print button opens the browser print dialog. Users can choose a physical printer or save as PDF from the system dialog.

### Left Configuration Panel

The panel controls only layout and presentation.

Field list:

- drag to reorder fields
- show / hide field
- edit printed field label
- display imported field type as read-only information

Layout controls:

- global row height slider or number input
- A4 orientation toggle
- template save and overwrite actions

The panel must not expose cell content editing.

### Main Preview

The main area shows the final paper-like output:

- A4 page ratio
- landscape and portrait modes
- continuous multi-page preview
- repeated table header on every page
- draggable column resize handles
- text wrapping inside cells
- compact multi-select tag pills
- image attachments scaled with `object-fit: contain`
- optional captions below images when present
- row hover or selection highlight for inspection only

The preview should prioritize print fidelity over dashboard-style decoration.

## Print Behavior

Printing uses CSS print styles and browser-native print output.

Print rules:

- Hide toolbar, side panel, and non-print UI.
- Print only the paper preview.
- Use A4 page size.
- Respect landscape or portrait orientation.
- Repeat table header per page when possible.
- Avoid splitting table rows across pages as much as browser printing allows.
- Use image containment, not cropping.
- Preserve readable text size for production use.

The app should be clear that PDF export happens through the system print dialog's "Save as PDF" option.

## Pagination

Default behavior is to keep each row together.

Implementation should use CSS such as `break-inside: avoid` for rows and print sections. Because browser engines may not guarantee perfect row pagination in all cases, the app should still be designed so very tall rows are rare:

- global row height is adjustable
- images fit within cell bounds
- long content wraps but does not become editable

If a single row becomes taller than one page, the browser may split it. That is acceptable as a hard edge case.

## Validation And Errors

When importing a session, validate:

- `data.json` exists.
- `fields` is an array.
- `rows` is an array.
- field IDs are unique.
- field types are supported.
- row cell keys reference known fields.
- text fields contain renderable primitive values.
- multi-select fields contain string arrays.
- image fields contain image arrays.
- image paths stay inside the session folder.
- image files exist.
- image file types are displayable by the browser.

When loading a template, validate:

- template JSON is parseable.
- paper settings are supported.
- column definitions are valid.
- missing field references are reported.
- duplicate column references are reported.

Errors should be specific and actionable:

- `第 3 行的 reference 图片不存在：assets/shot-003.jpg`
- `字段 voiceover 在 rows 中出现，但 fields 未定义`
- `当前模板引用了不存在的字段：location，可选择忽略或重置模板`

## Future Feishu / SKILL Integration

The frontend should remain independent from Feishu.

The future SKILL layer should:

- read Feishu Base or Feishu Sheet content
- map Feishu fields into `text`, `multiSelect`, or `image`
- download image attachments into a session `assets/` folder
- generate `data.json`
- create a new session folder under `imports/`
- optionally open the print app with that session selected

This keeps Feishu API changes outside the print renderer.

## Success Criteria

V1 is successful when:

- A user can load a session package and see a paper-like A4 shooting script table.
- The default view is a balanced landscape script table.
- Users can reorder, rename, show/hide, and resize columns without editing content.
- Image columns resize naturally with column width and row height.
- Shared templates can be saved to the project workspace and reused.
- Rows are kept together across page breaks in normal cases.
- Browser print output can be saved as PDF or sent directly to a printer.
- The app can be used as the final stage of a future `SKILL -> JSON -> print` workflow.

