# 庄Sir的脚本打印器 Usage

## Start

Run:

```sh
npm start
```

Open:

```text
http://localhost:4173
```

## Session Package

Each import lives in `imports/<session-id>/`.

Required:

- `data.json`
- `assets/` for local image files

Optional and app-generated:

- `layout.json`

`data.json` is the imported script-content snapshot. The web app can save user edits back to this local session copy. `layout.json` is created by the web app when the user adjusts the print layout for that session.

Image paths in `data.json` are relative to the session folder, for example:

```text
assets/shot-001-ref.jpg
```

## Printing

Use the `打印` button. The browser print dialog can send to a printer or save as PDF.

## Editing

The app can edit the local print session:

- text cells, with Markdown rendering
- TODO cells, using Markdown task markers such as `[ ]` and `[x]`
- tag/select cells, with existing-option search and new-option creation
- image captions, while image attachments stay local session assets

The app also changes layout:

- field display name
- field visibility
- field order
- column width
- fixed or auto row height
- grouping
- sorting
- A4 landscape or portrait
- shared template save

The app does not edit the source system. Web edits affect only the local `imports/<session-id>/data.json` copy.

Session-specific layout changes are saved in `imports/<session-id>/layout.json`, so reopening the same session restores the user's last print setup alongside any local content edits saved in `data.json`.

## Agent Skill Layer

Use `.agents/skills/zhuangsir-script-printer` when another agent or skill needs to prepare a print session for this app.

For Feishu/Lark sources, fetch rows, cells, and image attachments with the native lark skills first. Then pass the fetched result into this printer skill. The printer skill only maps the source into the initial session JSON format and opens the app; it must not rewrite, summarize, correct, translate, or otherwise change the source script content.
