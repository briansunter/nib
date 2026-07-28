<!-- generated-markdown-alternate -->
---
title: "Vannevar"
description: "Local RAG search for markdown files. SQLite FTS5 keyword search and HNSW vector search fused with Reciprocal Rank Fusion, running fully offline on a local ONNX embedding model."
url: "https://briansunter.com/projects/vannevar"
---

Oct 29, 2025

# Vannevar

Local RAG search for markdown files. SQLite FTS5 keyword search and HNSW vector search fused with Reciprocal Rank Fusion, running fully offline on a local ONNX embedding model.

project TypeScript Bun RAG Vector Search HNSW SQLite FTS5 Embeddings ONNX

## Overview

Vannevar is a local RAG search tool for markdown files. It builds a hybrid index over a directory of notes: BM25 keyword search via SQLite FTS5 and semantic vector search via an HNSW graph. It fuses the two ranked lists with Reciprocal Rank Fusion to return better results than either approach alone.

Everything runs offline. The embedding model ([nomic-embed-text-v1.5](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5), q4f16 quantized) downloads once and runs locally via ONNX, the vector index lives on disk, and queries hit a local SQLite database.

It is named after [Vannevar Bush](https://en.wikipedia.org/wiki/Vannevar_Bush), who envisioned the [Memex](https://en.wikipedia.org/wiki/Memex), a device for storing, linking, and retrieving personal knowledge.

## Features

### Hybrid search

FTS5 ranks chunks by BM25 keyword relevance. The vector store embeds the query with the same model used at index time and finds nearest neighbors via HNSW cosine similarity. RRF merges the two ranked lists with `score = weight / (k + rank)` at k=60, deduplicating chunks that appear in both, and normalizes so the top result is 1.0.

The CLI also exposes the underlying searches directly: `search` for BM25 only and `vsearch` for vector only, so you can fall back to whichever side fits the query.

### Markdown-aware chunking

The chunker respects heading hierarchy, keeps fenced code blocks and tables atomic, and applies configurable overlap between chunks so an answer that straddles a chunk boundary still surfaces.

### Fully local

No API keys, no cloud calls. The embedding model is \~111MB and downloads on first use; after that, everything (embedding, indexing, search) runs on the local machine.

### Root-aware indexes

Directory indexes store each document as `root path + relative path`, so a single database can hold multiple indexed directories with overlapping filenames. `get` accepts a unique relative path, an absolute path, or a `#` document/chunk ID prefix.

### Fast

FTS queries land in the \~0.1ms range, vector search in \~14ms, and the fused hybrid query in \~11ms on the bundled benchmarks.

## Quick start

bash

```
# Index a directory of markdown files
bun src/cli.ts index ./docs

# Hybrid search (default)
bun src/cli.ts query "how to configure authentication"

# Keyword search only (BM25)
bun src/cli.ts search "authentication config"

# Vector search only
bun src/cli.ts vsearch "setting up user login"

# Retrieve a chunk or document
bun src/cli.ts get setup.md
bun src/cli.ts get '#<chunk-or-document-id-prefix>'
```

Output flags cover `--json`, `--md`, `--csv`, `--xml`, and `--files` for compact file references.

## Architecture

Indexing runs in two phases with pipelining: read and chunk first, then embed and store. The store is SQLite via `bun:sqlite` and Drizzle ORM, with an FTS5 virtual table for keyword search. The vector side wraps [verso-db](/projects/verso) for the HNSW index, so the same vector store I use elsewhere drives the semantic half of the search.

## Technology stack

- TypeScript on the [Bun](https://bun.sh) runtime, using `bun:sqlite`, `Bun.file`, and `Bun.CryptoHasher`
- SQLite with [Drizzle ORM](https://orm.drizzle.team) for storage, FTS5 with porter stemming for keyword search
- [verso-db](/projects/verso) HNSW index for vector search
- [nomic-embed-text-v1.5](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5) embeddings via [@huggingface/transformers](https://github.com/huggingface/transformers.js) (ONNX, q4f16 quantized)
- [Biome](https://biomejs.dev) for linting

## Share this project
