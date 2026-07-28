<!-- generated-markdown-alternate -->
---
title: "wraptc: Multi-Provider AI Coding CLI"
description: "A unified CLI wrapper that routes coding requests across Gemini, OpenCode, Qwen Code, and Codex with automatic fallback, daily-credit tracking, and a built-in MCP server."
url: "https://briansunter.com/projects/wraptc"
---

Dec 24, 2025

# wraptc: Multi-Provider AI Coding CLI

A unified CLI wrapper that routes coding requests across Gemini, OpenCode, Qwen Code, and Codex with automatic fallback, daily-credit tracking, and a built-in MCP server.

[View Source](https://github.com/briansunter/wraptc)

project TypeScript Bun CLI MCP AI Agents Routing

![Cover image for wraptc: Multi-Provider AI Coding CLI](/_astro/wraptc-hero.DiuXDvDP_3bImf.webp)

## Overview

wraptc is a single CLI that fronts every other coding-agent CLI on my machine. Instead of remembering which tool has free quota left today, which one supports streaming JSON, and which one needs a different flag for file context, I run `wraptc ask -p "..."` and it picks the best available provider (Gemini CLI, OpenCode, Qwen Code, Codex, or any custom binary I’ve registered), falls back automatically when one runs out of credits or starts erroring, and tracks how many Claude tokens I’ve avoided spending in the process.

It also ships an MCP server, so Claude Desktop (and any other MCP client) can hand off coding subtasks to the same routing layer.

![Wraptc provider routing architecture diagram](/_astro/wraptc-explainer.BKIq1CgR_1WiBGj.webp)

Wraptc provider routing architecture diagram

## Why I built this

I use Claude as my main coding agent, but a lot of day-to-day requests (boilerplate generation, “explain this function”, “write a unit test for X”) don’t actually need Claude. The free tiers on Gemini, Qwen, and Codex are more than enough for those, and using them keeps my Claude usage focused on the work that’s worth it.

The problem is that each of those CLIs has its own UX. Different prompt flags, different ways to attach files, different streaming formats, different error semantics, different daily limits, and zero awareness of each other. Manually rotating between them (“Gemini’s out, try Qwen, wait, Qwen errored twice in a row, fall back to Codex”) is not how I want to spend my time.

wraptc is the layer that makes that boring. One command, one JSON shape, automatic routing.

## Features

### Multi-provider routing with automatic fallback

A priority list defines the default order (`["gemini", "opencode", "qwen-code", "codex"]` in my config). The router picks the first provider that is installed, hasn’t hit its daily request limit, isn’t currently in cooldown from consecutive errors, and supports the requested capability. If a request fails mid-flight with a retryable error, it falls back to the next provider transparently.

Per-mode overrides let me say “for `test` mode, prefer Codex over Gemini” without changing the global order.

### Daily credit tracking

Each provider has a configurable `dailyRequestLimit` and `resetHourUtc`. wraptc persists a per-provider counter in `~/.config/wraptc/state.json` and stops routing to a provider once its limit is hit, until the reset hour rolls around. No more “oops, I burned through Gemini’s free tier at 11pm and didn’t notice.”

### Error-threshold blacklisting

After N consecutive failures from a provider, wraptc blacklists it for a cooldown window. This catches the common failure mode where a provider’s API is flaking but each individual request still takes 10+ seconds to time out. Without it, the router would eat that latency on every request until I noticed.

### Tokens-saved tracking

Every successful delegation logs an estimate of the Claude tokens I would have spent if I’d run the same prompt through Claude. Over a week it adds up to a real number, and it’s the closest thing I have to a metric for “did this thing pay for itself.”

### Unified JSON-first API

Every provider returns the same shape:

json

```
{
  "provider": "qwen-code",
  "text": "...generated code...",
  "usage": { "inputTokens": 45, "outputTokens": 23 },
  "meta": { "elapsedMs": 1250 }
}
```

That’s true whether the underlying CLI emits structured JSON natively, only supports streaming JSONL, or just dumps text to stdout. wraptc has per-provider adapters that normalize all of those into the same envelope. Streaming is supported in JSONL or plain-text mode.

### Custom providers via config

Adding a new coding-agent CLI doesn’t require code changes. Drop a block into the providers map with a binary name, an args template, a JSON / streaming mode, and a list of capabilities, and the router treats it like any first-class provider:

json

```
{
  "providers": {
    "my-custom-llm": {
      "binary": "my-llm-cli",
      "argsTemplate": ["--model", "gpt-4", "--prompt", "{{prompt}}"],
      "streamingMode": "line",
      "capabilities": ["generate", "explain"]
    }
  }
}
```

### MCP server

`wraptc --mcp` runs the same router as a Model Context Protocol server. It exposes three tools: `run_coding_task`, `get_providers`, and `dry_run`. Claude Desktop can ask wraptc to delegate a task on its behalf, list what’s available, or preview which provider would be picked for a given prompt without burning the request.

That last one matters more than it sounds: it means Claude can reason about which subtasks are worth handing off vs. handling itself.

## Quick start

bash

```
# Install
brew install briansunter/wraptc/wraptc

# Use the best available provider
wraptc ask -p "Write a TypeScript function that reverses a string"

# Pin a specific provider
wraptc ask -p "Explain this code" --provider gemini

# Attach file context
wraptc ask -p "Refactor this module" -f src/utils.ts -f src/main.ts

# See what would run, without actually running it
wraptc ask -p "Generate tests" --dry-run

# Check provider state
wraptc providers
```

## Configuration

wraptc uses a layered config system, merged in this order:

1. Built-in defaults
2. System config (`/etc/wraptc/config.json`)
3. User config (`~/.config/wraptc/config.json`)
4. Project config (`./.config/wraptc/config.json`)
5. Environment variables (`WRAPTC_*`)
6. CLI flags

So a project can override the user-level routing order without touching global state. This is useful when one repo wants `["codex", "gemini"]` and another wants the opposite. Config is validated with [Zod](https://zod.dev/) on startup, so misconfigurations fail loud rather than silently routing to the wrong place.

## Architecture

The repo is a Bun monorepo with three packages:

plaintext

```
packages/
├── core/         # Provider abstraction, router, state, config
├── cli/          # Commander-based wraptc command
└── mcp-server/   # MCP protocol server using the same core
```

`packages/core` is the interesting one. Inside it:

- **`providers/`**: one adapter per provider, all implementing a common `Provider` interface. Adapters handle the per-CLI quirks (flag names, JSON modes, streaming formats, error parsing).
- **`router.ts`**: picks a provider given the request, the priority list, current state, and per-mode overrides; orchestrates fallback when a provider fails.
- **`state.ts`**: persists per-provider request counters, daily-reset bookkeeping, error history, and cooldown windows.
- **`config.ts`**: multi-source merge + Zod validation.

The CLI and MCP-server packages are both thin shells over core; everything that matters lives in one place.

## Error model

wraptc classifies provider errors into five buckets: `OUT_OF_CREDITS`, `RATE_LIMIT`, `TRANSIENT`, `BAD_REQUEST`, and `INTERNAL`. The router then decides whether to retry, fall back, or surface based on the class. `BAD_REQUEST` short-circuits and returns immediately (retrying a malformed prompt is pointless); `OUT_OF_CREDITS` puts the provider in cooldown until its reset hour and falls forward; `TRANSIENT` triggers an in-flight fallback to the next provider in the list.

## Technology stack

- TypeScript, packaged as a Bun monorepo
- [Bun](https://bun.sh/) for install, build, test, and link
- [Commander](https://github.com/tj/commander.js) for the CLI surface
- [Zod](https://zod.dev/) for config schema validation
- The official [Model Context Protocol](https://modelcontextprotocol.io/) SDK for the MCP server
- Native binaries built per-platform for the install-without-Bun path (curl-installer, Homebrew tap, GitHub Releases)

## License

MIT

## Share this project
