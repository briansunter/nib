<!-- generated-markdown-alternate -->
---
title: "UberSearch"
description: "One CLI/MCP front-end for Tavily, Brave, Linkup, and self-hosted SearXNG. Tries free providers first, falls back to paid ones, tracks credits."
url: "https://briansunter.com/projects/ubersearch"
---

Dec 23, 2025

# UberSearch

One CLI/MCP front-end for Tavily, Brave, Linkup, and self-hosted SearXNG. Tries free providers first, falls back to paid ones, tracks credits.

[View Source](https://github.com/briansunter/ubersearch)

project TypeScript CLI MCP Search Bun

![Cover image for UberSearch](/_astro/ubersearch-hero.B-IbaBTW_Z1UTUiK.webp)

## Overview

UberSearch is one CLI (and one MCP server) that fronts every web-search provider I use: Tavily, Brave, Linkup, and a Docker-managed SearXNG instance. By default it queries free SearXNG first and only falls back to the paid providers when SearXNG comes back empty or errors. Credits are tracked per provider so I notice before I burn through a free tier.

## How It Works

![UberSearch provider routing architecture diagram](/_astro/ubersearch-explainer.DNaEecKk_Z1EjeOS.webp)

UberSearch provider routing architecture diagram

The orchestrator runs a first-success strategy by default: SearXNG (auto-started via Docker), then Tavily, Brave, Linkup. There’s also an `all` strategy that fans out across every provider in parallel and merges the result sets. Credit usage is logged per engine.

## Features

- Multiple providers: Tavily, Brave, Linkup, SearXNG (Docker-auto-started)
- Plug-in custom providers via TypeScript
- Strategies: `all` (merge every provider) or `first-success` (cheapest path)
- Per-engine credit tracking with low-credit warnings
- MCP server for using it from Claude Desktop
- JSON or TypeScript config (`defineConfig`), XDG-aware paths
- Optional Docker integration for the SearXNG instance

## Technology Stack

- TypeScript on Bun
- Docker (optional) for SearXNG
- Model Context Protocol

## Share this project
