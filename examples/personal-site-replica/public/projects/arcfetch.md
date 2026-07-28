<!-- generated-markdown-alternate -->
---
title: "ArcFetch"
description: "Fetch a URL, get clean Markdown back. Plain HTTP first, Playwright fallback for JS-heavy pages, and quality gates that throw out paywalls and login walls before they reach you."
url: "https://briansunter.com/projects/arcfetch"
---

Dec 24, 2025

# ArcFetch

Fetch a URL, get clean Markdown back. Plain HTTP first, Playwright fallback for JS-heavy pages, and quality gates that throw out paywalls and login walls before they reach you.

[View Source](https://github.com/briansunter/arcfetch)

project TypeScript CLI MCP AI Web Scraping

![Cover image for ArcFetch](/_astro/arcfetch-hero.DmttLXFK_ZL0CKG.webp)

## Overview

ArcFetch is a URL-to-Markdown tool I built because every AI workflow I had eventually needed “give me the readable text from this page” and every existing option either choked on JavaScript-rendered sites, returned a wall of nav and ads, or silently handed back a paywall stub. It runs Mozilla Readability under plain HTTP first, retries with a stealthed Playwright browser when that fails, and rejects boilerplate, paywalls, and login walls before returning anything.

## How It Works

![ArcFetch pipeline diagram](/_astro/arcfetch-explainer.GHAb5iiT_1aRjPd.webp)

ArcFetch pipeline diagram

Four stages in order: fetch, extract, quality-gate, output. Plain HTTP runs first because it’s fast and free; if it returns blank or low-quality content, ArcFetch retries with Playwright in stealth mode. The quality gates score each result 0–100 and reject boilerplate, paywalls, login walls, and error pages before anything is saved.

## Features

- HTTP first, automatic Playwright fallback for JS-heavy sites
- Quality scoring (0–100) with detection for boilerplate, login walls, paywalls, and error pages
- Anti-bot escape hatches: stealth plugin, viewport / timezone / locale rotation, realistic headers
- Markdown output via Mozilla Readability + Turndown (typically 90–95% smaller than the raw HTML)
- Cache-to-temp workflow: stash a fetch in a temp folder, promote to `docs/` once you’ve checked it
- Link extraction so you can batch-fetch every link on a page you’ve already cached
- Available as both a CLI and an MCP server (6 tools)
- Output as plain text, JSON, file path, or summary

## Technology Stack

- TypeScript on Bun
- Mozilla Readability for content extraction
- Playwright (loaded only when the fallback fires)
- Turndown for HTML-to-Markdown conversion

## Share this project
