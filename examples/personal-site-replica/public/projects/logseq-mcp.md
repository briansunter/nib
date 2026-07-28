<!-- generated-markdown-alternate -->
---
title: "Logseq MCP"
description: "An MCP server that hooks Claude into your Logseq graph. Search blocks, draft daily notes, surface TODOs, and run Datalog queries in plain English."
url: "https://briansunter.com/projects/logseq-mcp"
---

Mar 21, 2025

# Logseq MCP

An MCP server that hooks Claude into your Logseq graph. Search blocks, draft daily notes, surface TODOs, and run Datalog queries in plain English.

[Visit Project](https://www.npmjs.com/package/logseq-mcp)

project TypeScript MCP Claude Logseq Knowledge Management

![Cover image for Logseq MCP](/_astro/logseq-mcp-hero.CUcS_G6A_Z1rivcC.webp)

## Overview

Logseq MCP connects Claude to a running Logseq instance over its HTTP API. Once it’s wired up, Claude can search the graph, read and write blocks, draft daily notes, pull lists of open TODOs, and run Datalog queries. All of this is available from a normal conversation.

I built it because most of what I do in Logseq follows the same handful of patterns (“what’s still TODO”, “summarise this page”, “stitch these scattered blocks into one outline”), and Claude is faster at those than I am with the keyboard.

## Features

### Knowledge Management

- Search the entire graph
- Summarise pages and block trees
- Create daily notes with predefined sections
- Re-nest flat block lists into a hierarchy

### Task Management

- Pull every block in a given task state (TODO, DOING, etc.)
- Extract action items from meeting notes
- Spin up structured task lists
- Walk task progress over time

### Search & Query

- Plain-language search across the graph
- Block-level content search
- Run advanced Datalog queries

### Content Organization

- Restructure block trees in place
- Group blocks by any criterion you can describe
- Convert flat dumps into nested outlines

## Example Usage

Ask Claude:

- “Find all my TODO tasks in Logseq”
- “Create today’s daily note with sections for Tasks, Notes, and Journal”
- “Summarise my Research page”
- “Search my graph for anything about machine learning”

## Installation

Enable the Logseq HTTP API, then add the server to your Claude Desktop config:

json

```
{
  "mcpServers": {
    "logseq": {
      "command": "npx",
      "args": ["logseq-mcp"],
      "env": {
        "LOGSEQ_TOKEN": "your_logseq_token"
      }
    }
  }
}
```

## Technology Stack

- TypeScript MCP server
- Logseq HTTP API
- Cross-platform binaries
- Distributed via npm / `bunx`

## Share this project
