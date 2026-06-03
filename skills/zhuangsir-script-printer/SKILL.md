---
name: zhuangsir-script-printer
description: Install or locate the local HTMLprinter app for 庄Sir的脚本打印器, convert user-provided shooting-script content sources into printer sessions, start the local preview server, and open the print/PDF page. Use when the user wants to install, initialize, print, preview, PDF, or persist a shooting script table from direct text, JSON, tables, Feishu/Lark Base, Feishu/Lark Sheets, Feishu docs, or outputs from other skills. Preserve source content exactly; for Lark/Feishu fetching, use native lark skills first.
---

# 庄Sir的脚本打印器 Skill

Create print sessions for the local HTML printer web app. The skill is an installer plus adapter layer:

```text
source / other skill / native lark skill
-> ensure HTMLprinter exists and localhost:4173 is running
-> exact initial session JSON
-> imports/<session-id>/data.json
-> http://localhost:4173/?session=<session-id>&template=balanced-landscape.json
-> user edits the local session if needed, adjusts layout, prints, or saves PDF
```

## Non-Negotiables

- Do not rewrite, polish, translate, summarize, merge, split, or correct script content.
- Do not edit source systems. The skill only creates a local printer session.
- Preserve source row order, field order, field names, tags, captions, and cell text exactly.
- Only transform structure: field IDs, field types, row IDs, and local asset paths.
- If a value is ambiguous and would require interpretation, ask the user or keep it as text.
- Use native lark skills for Feishu/Lark fetching and attachment download. This skill only consumes the fetched result.
- The web app may let the user edit the local session after import. Those edits are user-controlled changes to `imports/<session-id>/data.json`, not changes to the source system.

## Initialization Workflow

Always ensure the HTMLprinter app exists before writing a session. Resolve script paths relative to this skill folder; inside the open-source repository they live under `skills/zhuangsir-script-printer/scripts/`.

1. Try to locate and start an existing printer:

   ```sh
   node skills/zhuangsir-script-printer/scripts/ensure-printer.mjs --start
   ```

2. If the command says the printer is missing, install and start it:

   ```sh
   node skills/zhuangsir-script-printer/scripts/ensure-printer.mjs --install --start
   ```

3. Use the returned JSON `root` value as the printer project root for all later commands.

4. If the user already has a local copy, prefer that copy by passing:

   ```sh
   node skills/zhuangsir-script-printer/scripts/ensure-printer.mjs --root <HTMLprinter-project-root> --start
   ```

5. If install fails because of network or Git availability, report one short recovery instruction: install Git or download the repository manually, then rerun `ensure-printer.mjs --root <downloaded-folder> --start`.

Default install target is `~/Documents/ZhuangSir/HTMLprinter`. The installer clones `https://github.com/billzhuang6569/HTMLprinter.git`, validates the expected app files, and starts the local server on port `4173`.

## Workflow

1. Run the Initialization Workflow and keep the returned `root`.
2. Identify the content source.
   - Direct user input: parse only the provided content.
   - Output from another skill: use that output as the source.
   - Feishu/Lark Base, Sheets, Docs, Drive attachments: first invoke the relevant native lark skill to fetch rows/cells and download images locally.
3. Build a session object using `references/session-format.md`.
4. Preserve content exactly.
   - Text values stay text.
   - Multi-select/tag cells become string arrays without renaming tags.
   - TODO/checklist cells become Markdown-style task text or string arrays without rewriting item wording.
   - Image cells become arrays of `{ "path": "...", "caption": "..." }`.
5. Write the session with the `root` returned by `ensure-printer.mjs`:

   ```sh
   node skills/zhuangsir-script-printer/scripts/write-session.mjs --root <HTMLprinter-project-root> --input <session-json-file>
   ```

   Use `--session-id <id>` only when the user gave a meaningful stable id.
6. Open the returned URL in the browser, normally:

   ```text
   http://localhost:4173/?session=<session-id>&template=balanced-landscape.json
   ```

7. Tell the user:
   - imported source content was preserved when the initial session was created;
   - local web edits are saved to `imports/<session-id>/data.json`;
   - layout, grouping, sorting, field types, widths, row-height mode, and template adjustments are saved to `imports/<session-id>/layout.json`;
   - printing/PDF happens from the browser preview.

## Field Type Rules

- `text`: plain script values, including numbers and booleans. Text cells support Markdown rendering in the web app.
- `multiSelect`: source cells that are already tags/multi-select arrays, select/status/option fields, or clearly discrete fields such as `标签`, `状态`, `类型`, `分类`, `拍摄区域`. Preserve option labels exactly. If converting a single select value, wrap it as a one-item array.
- `image`: source cells containing downloaded local image paths or image attachment objects.
- `todo`: checklist, pending task, confirmation, preparation, or action-item cells. Use Markdown task markers when present (`[ ]`, `[x]`). Use this when source field names or explicit source types indicate `TODO`, `待办`, `任务`, `检查项`, `需确认`, `需准备`, `准备事项`, `确认事项`, `action item`, or `checklist`.

When unsure between `text`, `multiSelect`, and `todo`, prefer `text` unless the source system explicitly marks the field type or the field name clearly indicates tags/checklist semantics.

## Local Asset Rules

- Every print session owns its own folder under `imports/`.
- Image files must live inside that session folder, usually `assets/`.
- If downloaded images are absolute local paths, pass them through `write-session.mjs`; it copies them into `assets/` and rewrites only the asset path.
- Never reference remote URLs in `data.json`; download them first with the source skill.

## Script Responsibilities

- `scripts/ensure-printer.mjs`: locate an existing HTMLprinter root, optionally clone the app, validate the app shape, and start `localhost:4173`.
- `scripts/write-session.mjs`: validate the session against the installed app, copy local image assets into `imports/<session-id>/assets/`, write `data.json`, and return the preview URL.

## Persistence

`data.json` is the initial content snapshot generated from the source. The web app can persist user edits to this local copy. It must not write those edits back to Feishu/Lark or any other source system.

`layout.json` stores print presentation state: field labels/types/visibility/order, column widths, fixed/auto row height, grouping, sorting, paper orientation, and other template choices. This lets users reopen past print sessions with both local content edits and print layout restored.
