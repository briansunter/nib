<!-- generated-markdown-alternate -->
---
title: "SearchThing"
description: "Semantic search over your own documents, running entirely in the browser. Drop in PDFs, Markdown, or text; embeddings are generated on-device with Transformers.js."
url: "https://briansunter.com/projects/searchthing"
---

Feb 26, 2025

# SearchThing

Semantic search over your own documents, running entirely in the browser. Drop in PDFs, Markdown, or text; embeddings are generated on-device with Transformers.js.

[Visit Project](https://searchthing.briansunter.com/)

project TypeScript React AI Search Bun

![Cover image for SearchThing](/_astro/searchthing-hero.Gbk0qQRN_ZQ8Mcq.webp)

## Overview

SearchThing is a local-first document search tool that runs the entire pipeline (embedding, indexing, querying) inside the browser. Drop in PDFs, Markdown, or plain-text files, and search across them in natural language. Nothing leaves your machine; embeddings are generated on-device via [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js) inside a Web Worker.

## Features

- Semantic search via on-device embeddings (no API calls, no network round-trip)
- Hybrid BM25 + vector ranking with reciprocal rank fusion
- Upload, store, and browse PDFs, Markdown, and text
- All embedding work happens in a Web Worker so the UI doesn’t stutter
- Caches embeddings per chunk so unchanged content isn’t re-embedded
- Built-in reader view that highlights the chunk that matched your query
- Mobile layout with adaptive navigation
- Drop files anywhere in the window to upload

## Technology Stack

- TypeScript
- React
- Bun (server and bundler)
- Hugging Face Transformers.js for local embeddings
- shadcn/ui + Tailwind CSS
- Comlink for the main-thread ↔ worker bridge

## Share this project
