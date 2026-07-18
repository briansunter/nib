---
title: Getting Started
description: Add React and Markdown pages using folders.
layout: docs
---

# Getting started

Install dependencies and start the development server:

```bash
bun install
bun run dev
```

Create either file:

```text
src/pages/my-page/page.tsx
src/pages/my-page/page.md
```

Both become `/my-page/`.

Run the production checks before deploying:

```bash
bun run typecheck
bun run test
bun run build
```

The generated site is in `dist/client`.

## Markdown features

Remark GFM supports tables, task lists, autolinks, and strikethrough.

| Format | Supported |
| --- | --- |
| React TSX | Yes |
| Markdown | Yes |
