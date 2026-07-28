<!-- generated-markdown-alternate -->
---
title: "Logseq YouTube Captions"
description: "A Logseq plugin that grabs the captions for any YouTube link in a block and pastes the transcript in below it."
url: "https://briansunter.com/projects/logseq-youtube-captions"
---

Jun 13, 2022

# Logseq YouTube Captions

A Logseq plugin that grabs the captions for any YouTube link in a block and pastes the transcript in below it.

[View Source](https://github.com/briansunter/logseq-get-youtube-captions)

project TypeScript Logseq YouTube Plugin Captions

![Cover image for Logseq YouTube Captions](/_astro/logseq-youtube-captions-hero.BMOdNJ7a_Z2aqMBy.webp)

## Overview

A Logseq plugin that fetches the captions for any YouTube video referenced in a block and inserts the full transcript as a child block. Useful for keeping a searchable record of talks and tutorials in your graph, and even more useful when paired with an LLM plugin that can summarise or extract takeaways from the transcript.

## Features

- One slash command (`/get-youtube-captions`) or block-menu entry
- Works with embedded `{{video}}` blocks and any YouTube URL format
- Configurable caption language
- Pairs naturally with the GPT-3 plugin for summarisation

## Usage

1. Drop a YouTube link into any block
2. Run `/get-youtube-captions` from the slash menu
3. The transcript lands as a child block under the link

URL formats supported:

- Standard `youtube.com/watch?v=…`
- Short links `youtu.be/…`
- Embedded `{{video …}}` blocks

## Pairing with an LLM plugin

Run [my GPT-3 plugin](https://github.com/briansunter/logseq-plugin-gpt3-openai) on the resulting transcript to:

- Pull the top five takeaways from a long talk
- Summarise lectures and tutorials
- Extract key points from interviews

## Settings

- Caption language
- Helpful error messages when the requested language isn’t available

## Installation

Search for `get-youtube-captions` in the Logseq Marketplace.

## Technology Stack

- TypeScript with Vite
- Logseq Plugin API
- YouTube caption extraction
- Semantic-release for publishing

## Share this project
