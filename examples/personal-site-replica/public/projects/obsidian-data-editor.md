<!-- generated-markdown-alternate -->
---
title: "Obsidian Data Editor"
description: "An Obsidian plugin that opens .json, .yaml, and .yml files in a visual tree editor, with inline editing, schema validation, and a CodeMirror source mode."
url: "https://briansunter.com/projects/obsidian-data-editor"
---

Apr 28, 2026

# Obsidian Data Editor

An Obsidian plugin that opens .json, .yaml, and .yml files in a visual tree editor, with inline editing, schema validation, and a CodeMirror source mode.

project TypeScript Obsidian Plugin JSON YAML CodeMirror Bun

![Cover image for Obsidian Data Editor](/_astro/obsidian-data-editor-hero.CiPuXx06_Z2bHn8z.webp)

## Overview

Obsidian Data Editor turns `.json`, `.yaml`, and `.yml` files in your vault into a visual, collapsible tree. The plugin registers a custom file view so structured data opens as a browsable hierarchy by default. Edit scalar values inline, add and remove keys, search by key/value/path, and copy JSON Pointer paths. A CodeMirror-backed source mode and a side-by-side split mode are always one click away, so unusual constructs are never trapped behind the GUI.

![Obsidian Data Editor split view with JSON schema tree and source](/_astro/obsidian-data-editor-hero.CiPuXx06_Z1Gowb9.webp)

Obsidian Data Editor split view with JSON schema tree and source

YAML files keep their comments, anchors, aliases, tags, and multi-document structure across edits whenever the operation supports preservation. Schema validation can be enabled per file glob from the settings tab; schemas are loaded from inside the vault, and no network requests are made.

## Why I built this

I keep a lot of structured data in my vault (config files for other plugins, scraped datasets, frontmatter templates, recipe metadata, JSON Schemas for [Obsidian Schema](/projects/obsidian-schema)). Editing them as raw text is fine for a few keys but tedious once the document gets nested or large. I wanted the same thing my [CSV editor](/projects/obsidian-csv-editor) gives me for tabular data: open the file, click around, edit a value, save, all without leaving Obsidian or losing YAML comments.

## Features

### Tree mode

- Collapsible tree of nested objects, arrays, mappings, and sequences
- Inline edit for scalar values (string, number, boolean, null) with type-aware inputs; editing a `null` cell auto-detects the typed value’s type
- Inline rename of object keys
- Add property / add item, delete, duplicate, move up/down within a parent
- Type conversion (string ↔ number ↔ boolean ↔ null ↔ object ↔ array) with a confirm prompt for lossy YAML changes
- Keyboard navigation (arrow keys to move, Enter to expand/collapse, double-click to edit a scalar) with ARIA tree semantics
- Search keys, values, and paths with auto-expansion of ancestors
- Copy node path as JSON Pointer
- Undo / redo across tree edits
- Empty-document landing card with one-click root creation (Object / Array / String / Number / true / false / null)

### YAML preservation

- Comments, anchors, aliases, and tags shown as metadata badges on each row
- Operations preserve comments and anchors when the underlying YAML AST supports it; potentially-lossy edits prompt for confirmation (toggleable in settings)
- Multi-document files exposed as switchable document tabs; all documents are saved together so unedited documents are never dropped

### Source / split mode

CodeMirror 6 source editor with JSON / YAML syntax highlighting, bracket matching, fold gutters, and line numbers. Split mode shows the tree and source side by side, so you can navigate visually and drop into raw text whenever you need to.

### Schema validation

- JSON Schema validation via [Ajv](https://ajv.js.org/) (draft-07 by default)
- Schemas mapped to file globs in the settings tab (`pattern => path/to/schema.json`); patterns use `*` (any chars except `/`) and `**` (any chars)
- Diagnostics surface inline on the affected row, in a diagnostics panel below the tree, and in the status bar
- Vault-local only (no schemas are fetched over the network)

### File handling

Auto-save with configurable debounce (default 500 ms), or manual `Save now` from the toolbar. Saving is blocked while the document has parse errors; the “Allow saving invalid source” advanced setting overrides this when you need it.

## Settings

The settings tab is split into general (default mode, auto-save), JSON (indentation, sort keys on save, trailing newline), YAML (show anchors / aliases, confirm lossy operations), schema validation (enable, mapping table), and advanced (allow saving invalid source) sections.

## Technology stack

- TypeScript, bundled with esbuild into a single `main.js`
- React for the tree UI
- [CodeMirror 6](https://codemirror.net/) for the source editor
- [yaml](https://eemeli.org/yaml/) for AST-preserving YAML parsing
- [Ajv](https://ajv.js.org/) for JSON Schema validation
- Obsidian Plugin API (custom `FileView`, `registerExtensions`, vault read/modify)
- [Bun](https://bun.sh/) for install, scripts, and the adapter contract smoke harness

## License

0BSD

## Share this project
