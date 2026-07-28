<!-- generated-markdown-alternate -->
---
title: "Obsidian Schema"
description: "An Obsidian plugin that validates note frontmatter against user-defined JSON Schema rules, with tag-driven selectors, a results sidebar, and inline error reporting."
url: "https://briansunter.com/projects/obsidian-schema"
---

Apr 26, 2026

# Obsidian Schema

An Obsidian plugin that validates note frontmatter against user-defined JSON Schema rules, with tag-driven selectors, a results sidebar, and inline error reporting.

project TypeScript Obsidian Plugin JSON Schema Ajv Bun

![Cover image for Obsidian Schema](/_astro/obsidian-schema-hero.BY4SGNG3_u7C5L.webp)

## Overview

Obsidian Schema is a plugin that brings real, declarative validation to your vault. You define rules as JSON Schema in a single file at the vault root (`note-schema.json`), and the plugin checks every note’s frontmatter against them, flagging missing required fields, type mismatches, bad enum values, malformed dates, and more.

Each rule has two parts: a **selector** that decides which notes it applies to (typically tag-driven, e.g. “any note tagged `book`”) and a **schema** those notes must satisfy. Rules don’t fire on notes they don’t match, so you can add structure to a vault gradually without flagging every existing note.

## Why I built this

I have a vault of 5,000+ notes: books, movies, recipes, recruiter contacts, project pages, trip logs. Over the years the frontmatter drifted: some book notes had `author`, others didn’t; some used `rating` 0–5, others 0–10; recruiter contacts were missing dates. Dataview queries silently broke. I wanted a way to declare “every note tagged `book` must have an author and a positive page count” and have Obsidian tell me which ones are out of conformance.

JSON Schema is the right vocabulary for this. It’s battle-tested, expressive, and there’s a fast validator (Ajv) I could embed.

## Features

### Tag-driven rules

The default selector pattern matches notes by tag. A rule for book notes only fires on notes tagged `book` (frontmatter or inline `#book`):

json

```
{
  "id": "book-note",
  "selector": {
    "type": "object",
    "properties": {
      "tags": { "type": "array", "contains": { "const": "book" } }
    },
    "required": ["tags"]
  },
  "schema": {
    "type": "object",
    "required": ["author", "pages"],
    "properties": {
      "pages":  { "type": "integer", "minimum": 1 },
      "rating": { "anyOf": [{ "type": "null" }, { "type": "integer", "minimum": 0, "maximum": 10 }] }
    }
  }
}
```

Selectors are themselves JSON Schemas, so `anyOf`, `not`, and folder-anchored patterns (via the synthetic `$file.path`) are all available when you need them.

### Results sidebar

A right-pane view groups every issue by file with the rule name, frontmatter path, and a human-readable message. Click a file to jump to it. The status bar shows the running count.

### Live re-validation

Edit a note and the plugin re-validates just that file. Edit the schema and the entire vault is re-checked. The full-vault scan is debounced and coalesced so back-to-back saves don’t pile up runs.

### Helpful error messages

Ajv’s default messages are technical (`must NOT have additional properties`); the plugin formats them into readable form (`must have required property "author"`, `must be one of: planned, active, blocked, done`).

### Offline verification script

Because the rule compiler, data builder, and validator are pure functions, you can drive them from a Bun script and audit the entire vault in a single pass. This is useful when authoring a new rule to see how many notes match before reloading the plugin.

## What it does NOT do

By design:

- **No autofix.** Issues are reported only; your notes are not modified.
- **No body validation.** The plugin checks frontmatter (and inline tags). Markdown body content, links, and embeds are not in scope.
- **No `additionalProperties: false` by default.** Real notes accumulate ad-hoc fields; locking them down spams the sidebar.

## Technology stack

- TypeScript, bundled with esbuild
- [Ajv 8](https://ajv.js.org/) + `ajv-formats` for JSON Schema validation
- Obsidian Plugin API
- [Bun](https://bun.sh/) for the test runner; `bun test --coverage` reports 100% line coverage on the pure validation modules
- Vitest-style unit tests covering the selector engine, schema compiler, and a fully mocked validation service

## Project shape

plaintext

```
src/
├── note-data.ts          # builds the note → JSON object the validator sees
├── schema-config.ts      # parses note-schema.json, compiles each rule with Ajv
├── validator.ts          # selector predicate + schema check + error formatting
├── validation-service.ts # vault scanning, file lifecycle, subscription pub/sub
└── views/                # sidebar UI
```

The plugin is intentionally split into pure modules and Obsidian-API integration shims, so the validation logic is unit-testable without a running Obsidian instance.

## Share this project
