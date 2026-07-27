---
title: About
description: A short introduction to the person behind the projects.
layout: article
---

I’m Brian, a software engineer and entrepreneur living in Honolulu. I like
turning fuzzy ideas into tools that feel calm to use: a small command-line
utility, a local-first app, a recipe parser, or a website that makes a long
piece of writing easier to read.

This Nib replica mirrors the personal-site shape: writing, projects, recipes,
art, photos, pins, and a travel map all live beside one another. The content is
resolved at build time, so each route ships as ordinary HTML and CSS with
islands only where a control needs the browser.

## What I’m interested in

- browser-native tools that respect private data
- thoughtful static publishing and readable content systems
- AI as a practical instrument rather than a decorative feature
- drawing, cooking, walking, and noticing places

## How this replica is built

- **Writing** entries live at root-level slugs (for example
  `/why-large-language-models-are-interesting`), with `/pages` as the archive.
- **Projects** and **recipes** are generated from typed YAML and Cooklang
  snapshots through Nib page sources.
- **Galleries** (art, photos, pins) render responsive static images from copied
  site assets; the original Leaflet map and PhotoSwipe lightbox are intentionally
  approximated as accessible static lists and grids.
- **RSS** is published at `/index.xml` and the legacy `/rss.xml` redirects to it.

The full Astro source has more browser interaction (Satori OG images, Pagefind
search index, EXIF browser). This proof keeps the editorial site shape and the
build-time content pipeline; the missing integrations are listed in the README.
