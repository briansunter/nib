<!-- generated-markdown-alternate -->
---
title: "Obsidian CSV Editor"
description: "An Obsidian plugin that opens .csv files in a spreadsheet-like grid with keyboard navigation, range selection, copy/paste, sorting, and debounced auto-save."
url: "https://briansunter.com/projects/obsidian-csv-editor"
---

Apr 28, 2026

# Obsidian CSV Editor

An Obsidian plugin that opens .csv files in a spreadsheet-like grid with keyboard navigation, range selection, copy/paste, sorting, and debounced auto-save.

project TypeScript React Obsidian Plugin CSV Spreadsheet Bun

![Cover image for Obsidian CSV Editor](/_astro/obsidian-csv-editor-hero.BRGt-Uzg_Z8ahPR.webp)

## Overview

Obsidian CSV Editor turns any `.csv` file in your vault into an editable spreadsheet. The default Obsidian renderer treats CSVs as plain text; this plugin registers a custom view so they open as a grid with keyboard navigation, range selection, copy/paste, sortable columns, and debounced auto-save back to disk.

It’s built on [react-data-grid](https://github.com/adazzle/react-data-grid) for fast virtualised rendering, so wide files (thousands of rows / dozens of columns) stay smooth.

## Why I built this

I keep a lot of tabular data in my vault (workout logs, reading lists, finance trackers, scraped datasets), and editing them as raw text is tedious. The existing CSV plugins I tried either didn’t handle keyboard-first editing well, didn’t support range copy/paste against external spreadsheets, or rendered slowly on bigger files. I wanted something that felt like a real cell editor: tab between cells, paste a block from Google Sheets, sort a column, and have it save back transparently without leaving Obsidian.

## Features

### Native CSV view

`.csv` files open in the grid by default; no command is needed. The plugin registers a `FileView` against the `csv` extension so Obsidian routes them to it automatically.

### Keyboard-first editing

- Arrow keys to navigate
- Tab / Shift+Tab to move between cells (wraps to next/previous row at the end)
- Enter / Shift+Enter to commit and move down/up
- Type to start editing; F2 or Enter to enter edit mode explicitly

### Range selection and clipboard

Shift+Click, Shift+Arrow keys, or click-and-drag to select a rectangular range. Selected cells are highlighted, and Cmd/Ctrl+C/X/V act on the whole range. Pasting tab-separated content (e.g. from Excel or Google Sheets) fills the grid starting at the active cell, expanding the row count as needed.

### Right-click context menu

Insert / delete rows and columns at the click position, clear the active cell, or run copy / cut / paste over the current selection.

### Column sorting

Click any header to sort ascending / descending. Sort is non-destructive; saving writes back the original on-disk row order, so a sort is a view-only operation.

### Configurable delimiter

Comma, semicolon, tab, or pipe (set in plugin settings). The parser is RFC 4180 compliant: fields containing the delimiter, double quotes, or newlines are properly quoted on save, and embedded quotes are doubled.

### Debounced auto-save

Edits are debounced (default 300 ms, configurable 100–2000 ms) and written back via the Obsidian vault API. Auto-save can be toggled off, in which case the toolbar’s **Save** button writes on demand.

### Theme-aware styling

Colors and borders are wired to Obsidian’s CSS variables, so the grid follows your active theme (light, dark, or any community theme) without extra config.

### Mobile compatible

No desktop-only APIs, so it works on iOS and Android.

## Technology stack

- TypeScript, bundled with esbuild into a single `main.js`
- React 19 + [react-data-grid](https://github.com/adazzle/react-data-grid) for the virtualised grid
- Obsidian Plugin API (`FileView`, `registerExtensions`, vault read/modify)
- [Bun](https://bun.sh/) for install, scripts, and CI
- ESLint with `eslint-plugin-obsidianmd` for plugin-specific lint rules

## Project shape

plaintext

```
src/
├── main.ts            # Plugin entry: registers the view + settings tab
├── csvView.tsx        # FileView that mounts the React app into the leaf
├── CSVEditorApp.tsx   # Grid component, selection / clipboard / sorting logic
├── csvParser.ts       # RFC 4180 parse / serialize
├── clipboardUtils.ts  # Range + TSV helpers for copy/paste
└── settings.ts        # Settings tab and defaults
```

The plugin lifecycle file (`main.ts`) stays tiny: load settings, register the view against the `csv` extension, attach the settings tab. All real editing logic lives in the React app.

## Share this project
