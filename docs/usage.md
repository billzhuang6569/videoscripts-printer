# HTMLprinter Usage

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

Image paths in `data.json` are relative to the session folder, for example:

```text
assets/shot-001-ref.jpg
```

## Printing

Use the `打印` button. The browser print dialog can send to a printer or save as PDF.

## Layout Editing

The app only changes layout:

- field display name
- field visibility
- field order
- column width
- row height
- A4 landscape or portrait
- shared template save

The app does not edit imported script content. Change content in the source system or regenerate the session JSON.

