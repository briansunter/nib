<!-- generated-markdown-alternate -->
---
title: "Caliber"
description: "A web reader for your Calibre library. Cursor pagination and virtualised lists keep it fast on million-book collections; EPUB and PDF readers are built in."
url: "https://briansunter.com/projects/caliber"
---

Mar 3, 2026

# Caliber

A web reader for your Calibre library. Cursor pagination and virtualised lists keep it fast on million-book collections; EPUB and PDF readers are built in.

[View Source](https://github.com/briansunter/caliber)

project TypeScript Bun React SQLite TanStack Tailwind CSS MCP

![Cover image for Caliber](/_astro/caliber-hero.BfDjp7ps_Z17BSUK.webp)

## Overview

Caliber is a small web app that points at your existing [Calibre](https://calibre-ebook.com/) library (same SQLite database, same on-disk layout) and gives you a fast browser UI on top of it. The Calibre desktop app starts to drag once your library gets large; Caliber uses cursor-based pagination instead of `OFFSET` queries and virtualises the list view so scrolling stays smooth even on million-book collections. It also has built-in EPUB and PDF readers, so you can actually read in the browser instead of downloading first.

## Features

- Cursor pagination instead of `OFFSET` for speed at any library size
- Built-in EPUB reader (epub.js) and PDF viewer (pdf.js)
- Download any format Calibre has stored
- Virtualised list rendering with TanStack Virtual
- CLI for searching, browsing, and downloading from the terminal
- MCP server so Claude can search the library
- REST API: paginated listing, search, covers, downloads, stats

## Technology Stack

- Bun for runtime, bundling, and SQLite (`bun:sqlite`)
- React 19 with TanStack Router, Query, Virtual, and Table
- Tailwind CSS v4 with shadcn/ui
- epub.js and pdf.js for in-browser reading
- Biome for lint and format

## Share this project
