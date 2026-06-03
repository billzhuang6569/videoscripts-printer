# Session Format

The printer consumes `imports/<session-id>/data.json`.

## Required Shape

```json
{
  "title": "项目脚本表",
  "source": {
    "type": "direct | lark-base | lark-sheets | lark-doc | other-skill",
    "name": "source name",
    "generatedAt": "2026-06-03T12:00:00+08:00"
  },
  "fields": [
    { "id": "shot_no", "name": "镜头号", "type": "text" },
    { "id": "voiceover", "name": "旁白", "type": "text" },
    { "id": "visual", "name": "画面内容", "type": "text" },
    { "id": "reference", "name": "画面参考/分镜", "type": "image" },
    { "id": "notes", "name": "备注", "type": "text" },
    { "id": "todo", "name": "待办", "type": "todo" },
    { "id": "tags", "name": "标签", "type": "multiSelect" }
  ],
  "rows": [
    {
      "id": "row_001",
      "cells": {
        "shot_no": "01",
        "voiceover": "原文照抄",
        "visual": "原文照抄",
        "reference": [
          { "path": "/absolute/local/downloaded-image.png", "caption": "原 caption 照抄" }
        ],
        "notes": "",
        "todo": ["[ ] 原文照抄", "[x] 原文照抄"],
        "tags": ["外景", "重点"]
      }
    }
  ]
}
```

## Rules

- `field.id`: stable ASCII-ish identifier. It may be generated from the field name, but it must not alter `field.name`.
- `field.name`: exact source column/display name.
- `field.type`: one of `text`, `multiSelect`, `image`, `todo`.
- `rows[].id`: stable generated row id is allowed.
- `rows[].cells`: keys must match declared fields.
- Empty source cells should be represented as `""`, `[]`, or `null` according to field type.
- Do not add inferred commentary fields.
- Do not remove source fields merely because they are empty.
- Do not change the sequence of fields or rows unless the user explicitly asks.
- Text-like fields support Markdown rendering in the web app. Preserve Markdown exactly if the source already contains it.
- Multi-select fields must use string arrays. If the source is a single-select option, wrap the exact option label as a one-item array.

## Image Cell Values

Image fields must be arrays. Each item:

```json
{ "path": "assets/image.png", "caption": "optional exact caption" }
```

The `write-session.mjs` script accepts absolute local image paths and copies them into the session `assets/` folder.

## TODO Cell Values

TODO fields may be a string, a primitive value, or an array of primitive values. Preserve the source wording exactly.

Markdown task markers are allowed and rendered visually:

```json
["[ ] 确认场地", "[x] 准备脱敏屏幕"]
```

If the source gives plain text such as `"确认场地"` or `"需提前准备 / 确认"`, keep that plain text. Do not invent `[ ]` unless the source clearly indicates a checklist item.

## Local Persistence

After import, the web app may persist user edits to `imports/<session-id>/data.json`. Treat those as local print-session edits only. The skill must not write them back to Feishu/Lark/Base/Sheets/docs unless the user explicitly invokes a source-system skill for that purpose.

The web app persists layout and print presentation to `imports/<session-id>/layout.json`, including field labels/types/visibility/order, column widths, fixed or auto row height, grouping, sorting, orientation, and template choices.
