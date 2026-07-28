<!-- generated-markdown-alternate -->
---
title: "PokeClaude"
description: "An MCP server for Pokémon TCG Pocket. Claude can search the full card pool, find synergies, build 20-card decks, and read the meta."
url: "https://briansunter.com/projects/pokeclaude"
---

Oct 2, 2025

# PokeClaude

An MCP server for Pokémon TCG Pocket. Claude can search the full card pool, find synergies, build 20-card decks, and read the meta.

[Visit Project ](https://www.npmjs.com/package/pokemon-pocket-mcp-server)[View Source](https://github.com/briansunter/pokeclaude)

project TypeScript MCP Claude DuckDB AI

![Cover image for PokeClaude](/_astro/pokeclaude-hero.iy7LldOT_1C1tJB.webp)

## Overview

PokeClaude is an MCP server (and Claude Code plugin) that gives Claude access to the full Pokémon TCG Pocket card pool (2,077 cards including art variants, 1,068 unique) backed by an in-memory DuckDB so SQL queries against the catalogue are instant. Claude uses it to search, score synergies, propose 20-card decks, and look up the current meta.

## Features

- 7 MCP tools: search, filter, analyze, find synergies, find counters, deckbuild, meta
- Full card database (2,077 cards / 1,068 unique once art variants are deduped)
- DuckDB query engine; everything stays in-memory
- 20-card deck construction with energy and trainer balance
- Tier lists and usage stats from current meta data

## Claude Code Plugin

Four slash commands ship with the plugin:

- `/pokemon:build-deck`: build a 20-card deck around a chosen Pokémon or strategy
- `/pokemon:analyze`: analyse a card’s stats and matchups
- `/pokemon:find-counters`: find counters to a deck or archetype
- `/pokemon:meta`: current tier list and meta breakdown

## Technology Stack

- TypeScript MCP server (stdio transport)
- DuckDB for in-memory queries against the card data
- Web scraper that auto-refreshes the card data
- Claude Code plugin framework
- Distributed via npm / `bunx`

## How It Works

Install via npm or `bunx` and add the server to your Claude config. On startup it loads the card data into DuckDB and exposes the tools listed above. Claude calls them when you ask deck-building or meta questions.

## Share this project
