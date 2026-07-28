<!-- generated-markdown-alternate -->
---
title: "Obsidian Insights"
description: "An Obsidian plugin that generates live AI writing insights, connections, counter-arguments, and suggested edits while you write."
url: "https://briansunter.com/projects/obsidian-insights"
---

May 1, 2026

# Obsidian Insights

An Obsidian plugin that generates live AI writing insights, connections, counter-arguments, and suggested edits while you write.

project TypeScript Obsidian Plugin AI OpenAI Anthropic Knowledge Management

![Cover image for Obsidian Insights](/_astro/obsidian-insights-hero._ojVyznz_sMzSo.webp)

## Overview

Obsidian Insights is a desktop plugin that watches the active Markdown note and generates live writing feedback in a right sidebar. It can suggest concrete improvements, next ideas, counter-arguments, references, and connections to other notes in the vault.

I built it to make the AI assistant feel closer to a writing partner than a separate chat window. The plugin stays anchored to the note you are already editing, refreshes as the document changes, and keeps the output organized as structured insight cards instead of a long conversational transcript.

## Features

### Live insight sidebar

- Right-pane sidebar with generated insight cards for the active note
- Manual regenerate command for focused review passes
- Auto-run mode with a debounce and document-change threshold so feedback does not fire on every keystroke
- Per-category target counts for improvements, next ideas, connections, counter-arguments, references, and custom guidance

### Incremental refreshes

Instead of regenerating every card after every edit, the plugin keeps a snapshot of the previous run and re-anchors existing insights against the current document. Small changes can update locally, while larger changes trigger a revise call or a full regenerate when the note has drifted too far.

This keeps token usage lower and makes the sidebar feel less jumpy while writing.

### Vault-aware research

The model can call local vault tools during a run:

- Search notes
- Read note slices
- List backlinks and outgoing links
- Inspect note metadata
- Find notes by tag
- List recent notes

For semantic search, the plugin can use a local `qmd` binary when available. If QMD is missing or disabled, it falls back to an in-process lexical scan so the plugin still works without external setup.

### One-click fixes

For concrete edit suggestions, the sidebar can ask the model for a surgical replacement of the cited lines. Fixes are applied through the editor so changes stay visible and undo-friendly.

### Provider support

The plugin supports several model providers through the Vercel AI SDK:

- Anthropic
- OpenAI
- Google Gemini
- OpenRouter / OpenAI-compatible endpoints

Provider credentials stay in the vault-local plugin data file. There is no hidden telemetry; note text is sent only when an insight or auto-fix run is triggered.

## Technology stack

- TypeScript Obsidian plugin
- esbuild bundle to a single `main.js`
- Vercel AI SDK for streaming model calls and tool execution
- Zod schemas for validating model-submitted insight cards
- Obsidian Plugin API for commands, settings, views, editor access, and vault reads
- Optional local QMD process for semantic vault search

## Project shape

plaintext

```
src/
├── agent/       # model provider selection, prompts, tool schemas, auto-fix
├── runner/      # editor watching, run orchestration, incremental re-anchoring
├── ui/          # sidebar view, insight cards, thinking panel, fix application
├── util/        # fetch shim, text diffing, qmd process bridge, hashing
├── settings.ts  # provider, trigger, search, output, and guardrail settings
└── main.ts      # plugin lifecycle and command registration
```

The main plugin entry point stays small; most behavior lives in focused modules so the model loop, editor integration, and UI can evolve independently.

## Share this project
