<!-- generated-markdown-alternate -->
---
title: "Anki AI"
description: "An MCP server that exposes 45 Anki tools to Claude. Generate cards from text, audit decks, reschedule failures, and analyse your review history."
url: "https://briansunter.com/projects/anki-ai"
---

Sep 2, 2025

# Anki AI

An MCP server that exposes 45 Anki tools to Claude. Generate cards from text, audit decks, reschedule failures, and analyse your review history.

[Visit Project ](https://www.npmjs.com/package/anki-ai)[View Source](https://github.com/briansunter/anki-ai)

project TypeScript MCP Claude Anki Spaced Repetition

![Cover image for Anki AI](/_astro/anki-ai-hero.CJLjSt3T_1gbEMz.webp)

## Overview

Anki AI is an MCP server that wraps Anki’s local API and surfaces it to Claude as 45 tools, covering everything from card creation to deck stats. The point is to use Claude as the front door for the parts of Anki that are tedious in the desktop app: bulk tag rewrites, generating cloze cards from a PDF, finding the cards you keep failing.

![Anki AI tool capabilities diagram](/_astro/anki-ai-explainer.CNbV0sAP_Z1gLh8S.webp)

Anki AI tool capabilities diagram

## Features

- 45 tools covering cards, notes, decks, models, media, stats, and the Anki UI
- Generate cards from any text, PDF, or webpage
- Reschedule failures and tweak intervals based on your history
- Spot duplicates, leeches, and stale cards
- Bulk tag/move/update operations with auto-batching for large decks

## What You Can Do

### Create Learning Content

- Generate flashcards from PDFs, articles, or pasted text
- Cloze deletions for terminology
- Image-occlusion cards from diagrams
- Cards with audio for language learning

### Review Management

- Find difficult cards and analyse why they’re hard
- Reschedule failed cards based on actual performance
- Stretch intervals on cards you clearly know
- Detect and merge duplicates

### Mnemonics & Stories

- Generate stories that use today’s due vocabulary
- Mnemonic prompts for formulas
- Memory-palace scaffolding
- Example sentences in context

### Analytics

- Look at review patterns over time
- Predict which cards are about to lapse
- Surface knowledge gaps by tag or deck
- Track progress on a per-subject basis

## Tool Categories

- **Cards** (15): query, info, state, queue management
- **Notes** (10): CRUD and tag management
- **Decks** (7): create, delete, configure, stats
- **Models** (5): query and create card templates
- **Media** (3): store and retrieve files
- **Stats & GUI** (5): analytics and interface control

## Installation

Requires Anki running locally with the Anki-Connect add-on (code: `2055492159`).

json

```
{
  "mcpServers": {
    "anki": {
      "command": "npx",
      "args": ["anki-ai"]
    }
  }
}
```

## Technology Stack

- TypeScript MCP server with Zod-validated input
- Anki-Connect API
- Pagination and auto-batching for large decks
- Distributed via npm / `bunx`

## Share this project
