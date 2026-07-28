<!-- generated-markdown-alternate -->
---
title: "BlogSeq"
description: "A Logseq plugin that exports a page to clean Markdown and bundles every referenced image and asset alongside it. Works as a drop-in for Jekyll, Hugo, Astro, etc."
url: "https://briansunter.com/projects/blogseq"
---

Aug 31, 2025

# BlogSeq

A Logseq plugin that exports a page to clean Markdown and bundles every referenced image and asset alongside it. Works as a drop-in for Jekyll, Hugo, Astro, etc.

[View Source](https://github.com/briansunter/blogseq)

project TypeScript React Logseq Plugin Markdown

![Cover image for BlogSeq](/_astro/blogseq-hero.B0LTc9mR_1qe4o9.webp)

## Overview

BlogSeq exports a Logseq page to portable Markdown. Properties become YAML frontmatter, block and page references resolve to readable text, and every image referenced anywhere in the tree (including UUID-based references buried in properties) is found and bundled into an `/assets/` folder, with all paths rewritten to point at it.

I built it because publishing from Logseq used to mean copy-pasting Markdown and then chasing down broken images by hand. BlogSeq makes the export hand-off zero-touch.

## Features

### Asset bundling

The thing that took the most work to get right:

- Walks blocks, properties, and nested references for image links
- Resolves UUID-based asset references to real files on disk
- Drops everything into a single `/assets/` directory
- Rewrites links in the Markdown to relative paths

### YAML frontmatter

Logseq page properties come out as standard YAML frontmatter. Slot it straight into Jekyll, Hugo, Astro, or anything else that expects frontmatter at the top of a file.

### Reference resolution

- `((block-references))` resolved to the referenced block’s text
- `[[page links]]` rendered as readable text
- Nested and recursive references handled
- Image references-by-UUID inside properties resolved

### Live preview

See the rendered Markdown before exporting.

## Export Options

- Copy to clipboard
- Download a single `.md`
- Download a `.zip` with the Markdown plus every asset

## Configuration

- Page name as H1
- Flatten blocks into paragraphs
- Include / exclude properties
- Preserve or strip Logseq-specific markup
- Resolve or keep block / page references

## Technology Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- JSZip for the bundle
- Logseq Plugin API

## Share this project
