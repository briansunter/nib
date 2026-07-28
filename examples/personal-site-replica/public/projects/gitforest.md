<!-- generated-markdown-alternate -->
---
title: "Gitforest"
description: "A terminal UI for managing dozens of Git repositories at once: status dashboard, batch git operations, GitHub integration, and background fetches."
url: "https://briansunter.com/projects/gitforest"
---

Dec 2, 2025

# Gitforest

A terminal UI for managing dozens of Git repositories at once: status dashboard, batch git operations, GitHub integration, and background fetches.

[Visit Project](https://www.npmjs.com/package/gitforest)

project TypeScript Bun Ink React TUI Git GitHub SQLite

![Cover image for Gitforest](/_astro/gitforest-hero.CHDUP7Me_1XDlNN.webp)

## Overview

Gitforest is a terminal UI for managing many Git repositories at once. It scans configured directories for git repos, non-git projects, and submodules; surfaces uncommitted changes and unpushed/unpulled commits at a glance; and lets me run pull, push, fetch, or `gh`-driven GitHub operations across one repo or a whole selection without leaving the terminal.

I built it because I work across a `~/projects` folder with dozens of repos plus a dotfiles tree of submodules, and “is everything pushed?” was a question I kept answering by `cd`-ing through directories. Gitforest answers it on one screen.

## Features

### Project discovery

Configured directories are scanned with bounded depth and a concurrency limit. Gitforest recognizes git repos via `.git`, submodules via `.gitmodules`, and non-git projects via marker files (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `Gemfile`, `pom.xml`, `build.gradle`, and others) so I can spot folders that should probably be repos but aren’t yet.

### Status dashboard

For every git repo, the list shows:

- Clean / dirty working tree
- Number of unpushed and unpulled commits relative to the upstream
- Submodule indicator
- Last activity timestamp for sorting

Sort by name, status, or last activity; filter with `/` and a free-text query.

### Batch git operations

Multi-select with `space` (or `a` to select all), then run an operation across the whole selection:

- `p` push, `P` pull, `f` fetch
- `i` initialize git in selected non-git projects
- `c` create a GitHub repo for selected directories (default visibility configurable)
- `A` archive a GitHub repo

Push and pull are parallelized with backpressure; results stream back into the dashboard as they finish.

### Background sync

A worker fetches remotes every five minutes so the unpushed/unpulled counters stay roughly current without me hammering `f` myself.

### Caching

A local SQLite database (via Drizzle) caches the last scan result, so subsequent runs render instantly and only re-stat the directories that changed.

## Configuration

`~/.config/gitforest/config.yaml` controls which directories to scan and how:

yaml

```
directories:
  - path: ~/projects
    maxDepth: 2
    label: Projects
  - path: ~/.dotfiles
    maxDepth: 3
    label: Dotfiles

scan:
  ignore: [node_modules, .git, vendor]
  concurrency: 5

github:
  defaultVisibility: private

display:
  sortBy: status
  sortDirection: desc
```

`gitforest --init` writes a starter file the first time.

## Quick start

bash

```
# Run without installing
bunx gitforest --init
bunx gitforest

# Or install globally
bun add -g gitforest
gitforest
```

## Technology stack

- TypeScript on the Bun runtime, distributed on npm as `gitforest`
- [Ink](https://github.com/vadimdemedes/ink) for the terminal UI. React is rendered into a TTY
- `@inkjs/ui` and `ink-select-input` for higher-level components
- `Bun.$` for git shell operations, the `gh` CLI for GitHub operations
- Drizzle ORM over SQLite for the scan cache
- Zod for config validation, YAML for the config file format

## Share this project
