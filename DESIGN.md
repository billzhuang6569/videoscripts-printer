# Design

## Overview

庄Sir的脚本打印器 is a restrained local product UI for print preparation. The app chrome should stay quiet so the paper preview remains visually dominant.

## Color

- Background: cool neutral workspace gray.
- Paper: true white.
- Text: high-contrast near-black green-gray.
- Muted text: darker neutral green-gray, never low-contrast gray.
- Accent: teal used for primary actions, current state, sliders, focus, and selected controls.
- Warnings and errors use semantic color sparingly.

## Typography

- Use one sans-serif stack: Inter, system UI, and common Chinese UI fonts.
- Product UI labels use compact fixed sizes, not fluid type.
- Printed table text should remain dense, readable, and neutral.
- Avoid display typography and decorative tracking.

## Layout

- App shell: top toolbar, left layout panel, main A4 preview canvas.
- The preview area is the primary region; control density should not crowd it.
- Left panel controls should support fast scanning: row height first, then field list.
- Field rows should feel like sortable list items, not separate cards.
- Mobile layout stacks controls above preview while preserving the print surface.

## Components

- Buttons: compact, rectangular, clear primary/secondary distinction.
- Segmented controls: for orientation only.
- Sliders: for continuous numeric values such as row height and column width.
- Checkboxes: for binary field visibility.
- Sortable rows: use a drag handle, visible drag state, and keyboard-friendly fallback where practical.
- Inputs: for printed field labels only. Imported cell content is never editable.

## Interaction

- Column width can be changed from the preview resize handle or the field-list slider.
- Field order should be changed by direct drag in the left panel.
- Save template is explicit and uses the current layout state.
- Print opens the native browser print dialog.

## Anti-patterns

- No nested cards.
- No decorative gradients, glass blur, or oversized shadows.
- No rounded card radius above 12px.
- No arrow-button-only ordering when direct drag is expected.
- No content editor patterns for imported script cells.
