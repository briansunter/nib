<!-- generated-markdown-alternate -->
---
title: "CoolRSS"
description: "A local-first RSS reader and read-it-later desktop app (Tauri 2 shell, Rust core, React frontend, SQLite with FTS5 search, and a CLI that shares the same business logic)."
url: "https://briansunter.com/projects/coolrss"
---

Apr 8, 2026

# CoolRSS

A local-first RSS reader and read-it-later desktop app (Tauri 2 shell, Rust core, React frontend, SQLite with FTS5 search, and a CLI that shares the same business logic).

project Rust Tauri React TypeScript SQLite RSS TanStack CLI

![Cover image for CoolRSS](/_astro/coolrss-hero.BOzS3Ks6_Z2gjh7z.webp)

## Overview

CoolRSS is a desktop RSS reader and read-it-later app I run locally. It subscribes to feeds, fetches articles on a schedule, extracts the full body from the original page so I can read offline, and groups things I want to keep into collections. Everything lives in a SQLite database on disk with no account or server.

I built it because hosted readers keep dying or pivoting, and I wanted one app that handled both feed reading and the “save this article to read later” workflow without juggling Pocket, Instapaper, and a third RSS app. Same database, same search, same keyboard shortcuts.

## Features

### Feeds and articles

- RSS and Atom subscriptions with OPML import and export
- Per-domain rate limiting and concurrent fetching with backpressure
- Full-text search over article bodies via SQLite FTS5
- Smart feeds: All Saved, Today, Unread, Starred, plus tag and collection views
- Filter by feed, collection, tag, read state, or date range

### Read-it-later

Saving an arbitrary URL pulls the page, runs it through the content extractor, and stores a clean reading copy alongside subscribed feed articles. Saved items can be tagged, starred, dropped into collections, and searched the same way feed articles are.

### Collections and tags

Collections are folders for things I want to keep (Read Later, Reference, Documentation, Tutorials, Inspiration, Research). Tags are orthogonal labels (`important`, `follow-up`, `interesting`) that can be color-coded in the sidebar. Drag-and-drop reordering for both, with the order persisted to the database.

### Feed health

Fetch outcomes are classified into `Healthy`, `TransientError`, and `PermanentError`. Feeds with repeated permanent errors (404, 410, parse failures) are auto-deactivated after a strike threshold; transient errors (5xx, 429, timeouts) get more grace. Error counts reset on a successful fetch.

### Content extraction

A reader pipeline takes raw HTML and produces a clean article: strips chrome, resolves relative URLs against the source, picks out the canonical title, and returns sanitized HTML the frontend renders inside a styled article view. Code blocks keep their syntax highlighting.

### CLI

`coolrss-cli` is a separate binary that links the same Rust core. Same database file (with `--db <path>` to target the desktop app’s data directory), same fetch and parse logic, same OPML import. Useful for scripting feed adds, batch fetches from cron, or piping article JSON into an LLM workflow.

## Architecture

The repo is a Cargo workspace plus a Vite/React frontend:

| Path            | What it is                                                              |
| --------------- | ----------------------------------------------------------------------- |
| `coolrss-core/` | Shared Rust library (db, models, parser, fetcher, reader, OPML, health) |
| `coolrss-cli/`  | CLI binary built on `coolrss-core`                                      |
| `src-tauri/`    | Tauri 2 backend, thin command wrappers around `coolrss-core`            |
| `src/`          | React frontend, rendering only                                          |

Business logic lives in Rust. The Tauri command layer and the CLI are both glue around the same core, which means a feature only has to be implemented and tested once. The TypeScript side is deliberately dumb: it renders, it dispatches commands, it caches query results.

SQL migrations sit in `coolrss-core/migrations/NNN_name.sql` and run on every app or CLI start via `sqlx`’s migrator.

## Frontend

- React 19 with TanStack Router, Query, and Virtual
- shadcn/ui on Base UI primitives, Tailwind CSS v4
- Article selection driven by React state, not URL params, so switching articles doesn’t remount the reader pane and re-fetch
- Optimistic cache updates via `setQueryData` / `setQueriesData` for instant UI on read/star/save toggles

## Technology stack

- Rust 2024 with `sqlx`, `reqwest`, `feed-rs`, `scraper`, `tokio`
- Tauri 2 desktop shell, packaged for macOS, Windows, and Linux
- React 19 + Vite 7 + TanStack Router/Query/Virtual
- SQLite with FTS5 for storage and search
- shadcn/ui + Tailwind CSS v4 for the UI
- Bun as the package manager and frontend test runner

## Share this project
