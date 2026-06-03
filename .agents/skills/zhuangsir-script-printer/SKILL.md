---
name: zhuangsir-script-printer
description: Convert user-provided shooting-script content sources into sessions for 庄Sir的脚本打印器, then open the local print preview. Use when the user wants to print, preview, PDF, or persist a shooting script table from direct text, JSON, tables, Feishu/Lark Base, Feishu/Lark Sheets, Feishu docs, or outputs from other skills. This skill must preserve source content exactly and only map it into the printer session format; for Lark/Feishu fetching, use the native lark skills first.
---

# 庄Sir的脚本打印器 Skill

Create print sessions for the local web app. The skill is an adapter layer:

```text
source / other skill / native lark skill
-> exact session JSON
-> imports/<session-id>/data.json
-> http://localhost:4173/?session=<session-id>
-> user adjusts layout and prints in the browser
```

## Non-Negotiables

- Do not rewrite, polish, translate, summarize, merge, split, or correct script content.
- Do not edit source systems. This printer is read-only for content.
- Preserve source row order, field order, field names, tags, captions, and cell text exactly.
- Only transform structure: field IDs, field types, row IDs, and local asset paths.
- If a value is ambiguous and would require interpretation, ask the user or keep it as text.
- Use native lark skills for Feishu/Lark fetching and attachment download. This skill only consumes the fetched result.

## Workflow

1. Identify the content source.
   - Direct user input: parse only the provided content.
   - Output from another skill: use that output as the source.
   - Feishu/Lark Base, Sheets, Docs, Drive attachments: first invoke the relevant native lark skill to fetch rows/cells and download images locally.
2. Build a session object using `references/session-format.md`.
3. Preserve content exactly.
   - Text values stay text.
   - Multi-select/tag cells become string arrays without renaming tags.
   - Image cells become arrays of `{ "path": "...", "caption": "..." }`.
4. Write the session with:

   ```sh
   node .agents/skills/zhuangsir-script-printer/scripts/write-session.mjs --input <session-json-file>
   ```

   Use `--session-id <id>` only when the user gave a meaningful stable id.
5. Ensure the local server is running:

   ```sh
   npm start
   ```

   If port 4173 is already serving the app, reuse it.
6. Open the returned URL in the browser, normally:

   ```text
   http://localhost:4173/?session=<session-id>
   ```

7. Tell the user that layout changes in the web UI are saved as `imports/<session-id>/layout.json`.

## Field Type Rules

- `text`: plain script values, including numbers and booleans.
- `multiSelect`: source cells that are already tags/multi-select arrays.
- `image`: source cells containing downloaded local image paths or image attachment objects.

When unsure between `text` and `multiSelect`, prefer `text` unless the source system explicitly marks the field as multi-select/tags.

## Local Asset Rules

- Every print session owns its own folder under `imports/`.
- Image files must live inside that session folder, usually `assets/`.
- If downloaded images are absolute local paths, pass them through `write-session.mjs`; it copies them into `assets/` and rewrites only the asset path.
- Never reference remote URLs in `data.json`; download them first with the source skill.

## Persistence

`data.json` is the immutable content snapshot. The web app saves user layout adjustments separately as `layout.json` in the same session folder. This lets users reopen past print sessions without changing the original script data.
