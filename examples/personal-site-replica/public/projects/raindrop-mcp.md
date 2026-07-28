<!-- generated-markdown-alternate -->
---
title: "Raindrop MCP"
description: "An MCP server for Raindrop.io, letting Claude (or any MCP client) read, write, and reorganise your bookmarks, collections, tags, and highlights."
url: "https://briansunter.com/projects/raindrop-mcp"
---

Sep 20, 2025

# Raindrop MCP

An MCP server for Raindrop.io, letting Claude (or any MCP client) read, write, and reorganise your bookmarks, collections, tags, and highlights.

[Visit Project ](https://www.npmjs.com/package/@briansunter/raindrop-mcp)[View Source](https://github.com/briansunter/raindrop-mcp)

project TypeScript MCP Claude Raindrop.io Bookmarks

![Cover image for Raindrop MCP](/_astro/raindrop-mcp-hero.BkgLujFJ_1aNUtF.webp)

## Overview

Raindrop MCP exposes the [Raindrop.io](https://raindrop.io/) API as an MCP server, so Claude and other MCP clients can search bookmarks, create new ones, manage collection trees, and clean up tags conversationally instead of through the Raindrop UI.

I built it because most of my “save for later” links live in Raindrop, and being able to ask “find me everything I saved about Postgres last year and tag it `db`” is much faster than clicking through the web app.

![Raindrop MCP architecture diagram](/_astro/raindrop-mcp-explainer.OSlbfVCM_Z99VwB.webp)

Raindrop MCP architecture diagram

## Features

- Create, search, update, delete bookmarks
- Browse and manage nested collections
- List, merge, rename, and clean up tags
- Pull metadata from any URL (title, description, og-image)
- Raindrop’s full search syntax (`#tag`, `site:`, `type:`, etc.)
- Field filtering so responses stay small
- Bulk operations for tag-rewrite migrations

## Available Tools

### Bookmarks

- `list-raindrops`: list bookmarks in a collection
- `search-raindrops`: search with Raindrop’s query syntax
- `create-raindrop`: save a new bookmark, auto-parsed from URL
- `update-raindrop` / `delete-raindrop`: edit or remove existing bookmarks

### Collections & Tags

- `list-collections` / `create-collection`: manage the folder tree
- `list-tags` / `merge-tags`: clean up your tag taxonomy

### Utilities

- `parse-url`: pull metadata from a URL without saving it
- `check-url-exists`: duplicate-check before adding
- `list-highlights`: read your saved highlights

## Installation

Add to your Claude Desktop config and set your Raindrop API token:

json

```
{
  "mcpServers": {
    "raindrop": {
      "command": "npx",
      "args": ["-y", "@briansunter/raindrop-mcp"],
      "env": {
        "RAINDROP_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Technology Stack

- TypeScript MCP server (stdio)
- Raindrop.io REST API
- Field filtering and pagination
- Distributed via npm / `bunx`

## Share this project
