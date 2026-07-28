<!-- generated-markdown-alternate -->
---
title: "RSS AI"
description: "A CLI RSS/Atom feed reader with OPML support, smart caching, full-text search, content extraction, broken link repair, and an interactive TUI."
url: "https://briansunter.com/projects/rss-ai"
---

Feb 12, 2026

# RSS AI

A CLI RSS/Atom feed reader with OPML support, smart caching, full-text search, content extraction, broken link repair, and an interactive TUI.

[Visit Project](https://www.npmjs.com/package/rss-ai)

project TypeScript Bun CLI TUI RSS SQLite Drizzle

![Cover image for RSS AI](/_astro/rss-ai-hero.bGD9l2Xk_rE1JP.webp)

## Overview

RSS AI is a command-line RSS and Atom feed reader. It manages subscriptions in a local SQLite database, fetches feeds with HTTP conditional requests so it does not re-download what has not changed, extracts full article content from the original page, and ships an interactive terminal UI for reading.

I built it because most feed readers want to be a server or a hosted service, and I wanted something I could run as `bunx rss-ai` against a local database, script with JSON output, and pipe into an LLM workflow when I felt like it.

## Features

### Feeds and articles

- RSS and Atom feed support with lenient parsing
- OPML import and export covering 1.0, 1.1, and 2.0 formats
- Per-domain rate limiting and configurable concurrent fetching
- Full-text search across articles via SQLite FTS5
- Filter by feed, category, author, read or unread, starred, broken links, or date
- Flexible date formats: ISO, relative (`yesterday`, `this week`), expressions (`3 days ago`), and ranges

### Smart caching

Three layers minimize bandwidth:

1. HTTP conditional requests using ETag and If-Modified-Since
2. Content hashing (MD5) to detect changes when servers ignore cache headers
3. In-memory deduplication on `guid` and `link` to prevent duplicate inserts

`--force` bypasses all of them when needed.

### Content extraction and link repair

Articles can fetch their full body from the original page rather than relying on the (often truncated) feed entry. A repair pass tries HTTP/HTTPS swaps, `www` toggling, and an archive.org fallback for links that no longer resolve, and can flag or remove articles that stay broken.

### Auto-deactivation on persistent errors

Feeds with repeated permanent errors (404, 410, 403, parse failures) are deactivated after three strikes; transient errors (5xx, 429, timeouts, DNS) get five. Error counts reset on a successful fetch, and a feed can be reactivated with a single command.

### Interactive TUI

A `rss tui` command launches a terminal UI built on `@opentui/react` with keyboard navigation, markdown rendering, search, sort cycling, and three resizable layout modes. Keys follow vim-style conventions (`j`/`k`, `g`/`G`, `/` for search) alongside the standard arrow keys.

### Scripting and agent workflows

Every command takes a `-j, --json` flag that emits structured output, and a `--quiet` flag that suppresses everything else. The CLI is designed to compose with shell pipelines and LLM tool-call loops (list articles, pipe the JSON into a model, mark them read, and so on).

## Quick start

bash

```
# Run directly with bunx
bunx rss-ai feed add https://hnrss.org/frontpage
bunx rss-ai fetch all
bunx rss-ai article list --unread
bunx rss-ai tui
```

The database auto-initializes on first use and runs Drizzle migrations on every boot.

## Technology stack

- TypeScript on the Bun runtime, distributed on npm as `rss-ai`
- SQLite with Drizzle ORM for storage and migrations, FTS5 for search
- `commander` for the CLI, `@opentui/react` for the TUI
- `xml2js` for feed parsing, `cheerio` and `turndown` for content extraction
- `bun build --compile` produces a standalone binary

## Share this project
