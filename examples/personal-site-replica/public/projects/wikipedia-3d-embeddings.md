<!-- generated-markdown-alternate -->
---
title: "Wikipedia 3D Embeddings"
description: "Embed thousands of Wikipedia articles, project them into 3D with UMAP, and fly through the result in the browser. Articles cluster by what they're about, not by what folder they live in."
url: "https://briansunter.com/projects/wikipedia-3d-embeddings"
---

Aug 26, 2023

# Wikipedia 3D Embeddings

Embed thousands of Wikipedia articles, project them into 3D with UMAP, and fly through the result in the browser. Articles cluster by what they're about, not by what folder they live in.

[Visit Project ](https://briansunter.github.io/wikipedia-3d-embeddings/)[View Source](https://github.com/briansunter/wikipedia-3d-embeddings)

project Python Three.js Machine Learning UMAP Text Embeddings Data Visualization

![Cover image for Wikipedia 3D Embeddings](/_astro/wikipedia-3d-embeddings-hero.DlMa9D6O_1NPeNU.webp)

## Overview

This started as an experiment in self-organising knowledge: instead of categorising Wikipedia articles by hand, embed them with a sentence-transformer, run UMAP to drop the high-dimensional vectors into 3D, and render the result with Three.js. Articles end up positioned by meaning. The planets and astronomy stuff sits in one cloud, the World War II stuff sits in another, and you can fly through it in the browser.

## Features

- Renders 1,000 or 10,000 Wikipedia articles in 3D
- No manual categorisation. Positions come from the embedding model.
- Pan, rotate, zoom
- Articles colored by region of the cloud to make groupings legible
- Distance-based label sizing and billboarding so labels don’t pile up
- Pure browser rendering with Three.js

## Technology Stack

**Python pipeline:**

- `sentence-transformers` (all-MiniLM-L6-v2) for embeddings
- UMAP for the 384D → 3D reduction
- Wikipedia API for article text

**Frontend:**

- Three.js
- WebGL
- Canvas-based label rendering

## How It Works

1. **Embed**: each article is turned into a 384-D vector via a sentence-transformer
2. **Reduce**: UMAP collapses 384 dimensions to 3 while preserving local structure
3. **Render**: articles are placed at the resulting (x, y, z) coordinates in a Three.js scene
4. **Explore**: you fly around with mouse and keyboard

## Notes

- Articles can sit between categories; nothing forces a single tag.
- Adding new articles re-positions the cloud. The layout is emergent, not pre-baked.
- Some of the unexpected adjacencies (biology articles next to chemistry, certain historical figures clustered by era rather than nationality) are more interesting than the categorical groupings I’d have written by hand.
- 3D preserves more of the original neighbourhood structure than 2D, which matters once the data set gets big.

## The Dataset

[Wikipedia’s Vital Articles](https://en.wikipedia.org/wiki/Wikipedia:Vital_articles), in two sizes:

- **1K**: Level 3 vital articles (essential topics)
- **10K**: Level 4 vital articles (broader coverage)

Articles are split into 500-word chunks and the chunk embeddings averaged per article, so each point represents a single article’s “average meaning.”

## Demo & Code

- [Live Demo](https://briansunter.github.io/wikipedia-3d-embeddings/)
- [Source Code](https://github.com/briansunter/wikipedia-3d-embeddings)

## Share this project
