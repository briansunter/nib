<!-- generated-markdown-alternate -->
---
title: "Z.AI CLI"
description: "Unified command-line interface and MCP server for Z.AI services: image generation, OCR, vision, web search, web reader, and Zread code research."
url: "https://briansunter.com/projects/z-cli"
---

Feb 11, 2026

# Z.AI CLI

Unified command-line interface and MCP server for Z.AI services: image generation, OCR, vision, web search, web reader, and Zread code research.

[Visit Project ](https://www.npmjs.com/package/@briansunter/z-cli)[View Source](https://github.com/briansunter/z-cli)

project TypeScript CLI MCP AI Bun

![Cover image for Z.AI CLI](/_astro/z-cli-hero.B0ZpO9m9_21ysTJ.webp)

## Overview

Z.AI CLI is a single command-line tool that wraps the Z.AI service catalog (image generation, OCR, vision analysis, web search, web reader, and code research via Zread) and exposes the same tools as a Model Context Protocol server for Claude Code. One install, one API key, eight tools.

![Z.AI CLI capabilities overview](/_astro/z-cli-explainer.C1i__Vsg_ZbC2Ar.webp)

Z.AI CLI capabilities overview

## Features

- **Image Generation**: Generate images from prompts with quality and size controls
- **OCR**: Extract text from images and PDFs (URLs or local paths)
- **Vision**: Ask natural-language questions about images
- **Web Search**: Query the web with recency and result-count filters
- **Web Reader**: Fetch and parse web pages into clean text or markdown
- **Zread Code Research**: Search docs, get repo structure, and read files from any GitHub repo
- **MCP Server**: All tools exposed to Claude Code with selectable subsets (`mcp web`, `mcp zread`, etc.)
- **Zero Install**: Run via `bunx @briansunter/z-cli` without installing globally

## CLI Usage

bash

```
# Image generation
bunx @briansunter/z-cli image "a sunset over mountains" --quality hd --size 1280x1280

# OCR: extract text from images and PDFs
bunx @briansunter/z-cli ocr ./document.pdf

# Vision: analyze images
bunx @briansunter/z-cli vision ./photo.png "Describe this image"

# Web search and reader
bunx @briansunter/z-cli search "Claude Code MCP server" --count 5 --recency oneWeek
bunx @briansunter/z-cli read https://bun.com --format text --no-images

# Code research via Zread
bunx @briansunter/z-cli zread search facebook/react "hooks"
bunx @briansunter/z-cli zread structure vercel/next.js
bunx @briansunter/z-cli zread read vercel/next.js package.json
```

## MCP Server

Run the full MCP server or scope it to a single capability; this keeps Claude Code’s tool surface small.

bash

```
bunx @briansunter/z-cli mcp           # All 8 tools
bunx @briansunter/z-cli mcp image     # generate_image only
bunx @briansunter/z-cli mcp web       # web_search + web_reader
bunx @briansunter/z-cli mcp zread     # search_doc, get_repo_structure, read_file
```

Add to your `.mcp.json` for Claude Code:

json

```
{
  "mcpServers": {
    "z-ai": {
      "command": "bunx",
      "args": ["@briansunter/z-cli", "mcp"],
      "env": { "Z_AI_API_KEY": "${Z_AI_API_KEY}" }
    }
  }
}
```

## Technology Stack

- TypeScript on Bun
- Z.AI REST APIs (image, OCR, vision, search, reader, Zread)
- Model Context Protocol (stdio transport)
- npm / bunx distribution

## Share this project
