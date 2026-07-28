<!-- generated-markdown-alternate -->
---
title: "Verso"
description: "A high-performance vector database for Bun, Node.js, and the browser. HNSW indexing, Int8 quantization, and pluggable storage backends."
url: "https://briansunter.com/projects/verso"
---

Nov 26, 2025

# Verso

A high-performance vector database for Bun, Node.js, and the browser. HNSW indexing, Int8 quantization, and pluggable storage backends.

[Visit Project](https://www.npmjs.com/package/verso-db)

project TypeScript Vector Search HNSW Embeddings RAG Bun OPFS

![Cover image for Verso](/_astro/verso-hero.IWyACpqL_11wA9s.webp)

## Overview

Verso is an embeddable vector database written in TypeScript. It runs the same HNSW index in Bun, Node.js, and the browser, persists to the local file system or the Origin Private File System depending on where it is loaded, and ships with Int8 quantization, metadata filtering, and a small library of pre-tuned parameter presets.

I built it because most ANN libraries assume a server. I wanted something I could drop into a Bun script, a desktop app, or a static web page and have it index a few hundred thousand vectors locally without spinning up a separate service.

![Verso vector index architecture diagram](/_astro/verso-explainer.CPCq7YxQ_ZcGx5T.webp)

Verso vector index architecture diagram

## Features

### HNSW index

- Hierarchical Navigable Small World graph for approximate nearest neighbor search
- Cosine, Euclidean, and dot product distance metrics
- Build-time (`M`, `efConstruction`) and query-time (`efSearch`) tuning
- Tuned presets target 95-99%+ Recall@10 depending on data and `efSearch`
- Sub-millisecond to low-millisecond queries in the bundled benchmarks

### Int8 quantization

A `ScalarQuantizer` trains on a sample of vectors and produces an Int8 representation that uses 4x less memory than the original Float32 vectors, with minimal recall loss. A `QuantizedVectorStore` keeps the compact form in memory for environments where every byte matters.

### Multi-platform storage

Verso picks the right backend automatically:

- **Bun / Node.js**: file system via `BunStorageBackend`
- **Browser**: Origin Private File System via `OPFSBackend`
- **Fallback**: in-memory `MemoryBackend` when persistence is not available

The same collection API works across all three, so a snippet that builds an index in a Bun script can run unchanged inside a web worker.

### Metadata filtering

Each vector can carry an arbitrary metadata object, and queries accept a MongoDB-style filter that runs alongside the ANN search:

ts

```
const results = await collection.query({
  queryVector: queryVec,
  k: 10,
  filter: {
    category: 'tech',
    score: { $gt: 0.5 },
    tags: { $in: ['ai', 'ml'] }
  }
});
```

Supported operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`.

### Parameter presets

A small set of named presets covers the common cases without forcing users to learn HNSW tuning:

- By dimension: `low-dim`, `medium-dim`, `high-dim`, `very-high-dim`
- By dataset size: `small-dataset`, `large-dataset`
- By goal: `max-recall`, `low-latency`
- By embedding model: `getRAGPreset('text-embedding-3-large')` and friends

`getRecommendedPreset(dimension)` picks a sensible default automatically.

### Batch and upsert

Single-vector add, batch add, upsert (update existing or insert new), single and batch delete, batch query, and a `compact()` operation that permanently reclaims space from soft-deleted vectors.

## Quick start

ts

```
import { VectorDB } from 'verso-db';

const db = new VectorDB({ storagePath: './my_vectors' });
const collection = await db.createCollection('docs', { dimension: 3 });

await collection.add({
  ids: ['a', 'b', 'c'],
  vectors: [
    new Float32Array([1, 0, 0]),
    new Float32Array([0, 1, 0]),
    new Float32Array([0, 0, 1])
  ]
});

const results = await collection.query({
  queryVector: new Float32Array([1, 0.1, 0]),
  k: 2
});

console.log(results.ids); // ['a', 'b']
await db.close();
```

## Technology stack

- TypeScript, distributed on npm as `verso-db`
- HNSW implementation written from scratch
- Bun and Node.js runtime support, plus a browser build using OPFS
- Vitest for unit tests, plus a separate browser test suite
- Recall, storage, and end-to-end benchmark suites against the Cohere Wikipedia dataset

## Share this project
