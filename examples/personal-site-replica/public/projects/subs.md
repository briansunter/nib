<!-- generated-markdown-alternate -->
---
title: "Subs: Email Signup API"
description: "An email-signup API that writes straight into a Google Sheet. Cloudflare Turnstile blocks bots, Bun or Workers as the runtime, no separate database to operate."
url: "https://briansunter.com/projects/subs"
---

Jan 12, 2026

# Subs: Email Signup API

An email-signup API that writes straight into a Google Sheet. Cloudflare Turnstile blocks bots, Bun or Workers as the runtime, no separate database to operate.

[Visit Project ](https://github.com/briansunter/subs)[View Source](https://github.com/briansunter/subs)

project TypeScript Bun ElysiaJS Cloudflare Workers Google Sheets API

![Cover image for Subs: Email Signup API](/_astro/subs-hero.DK7OpO0p_Z1xDPth.webp)

## Overview

Subs is a tiny email-signup API. You POST an email, it writes a row to a Google Sheet, and you stop having to operate a database for what was always just “a list of email addresses.” It also wires in Cloudflare Turnstile so spam bots get filtered before the row is written, and ships embeddable widgets so you can drop the form into a static site without touching the backend.

## Features

- **Google Sheets storage**: no separate database; writes go straight to a sheet, with auto-tab-creation and dedup across tabs.
- **Cloudflare Turnstile**: invisible bot protection; no checkbox CAPTCHAs.
- **Multiple embed surfaces**: iframe widget, inline HTML, raw POST endpoint, or a JS SDK.
- **Extended metadata**: name, source, tags, and arbitrary metadata alongside the email.
- **Bulk endpoint**: accept up to 100 signups in one request.
- **Observability built in**: Prometheus metrics, structured JSON logs, health and stats endpoints.

## Deployment Options

- Bun / Node server with hot reload for local dev
- Cloudflare Workers for an edge deploy
- Multi-stage Dockerfile + Compose

## API Endpoints

| Endpoint                    | Description                    |
| --------------------------- | ------------------------------ |
| `POST /api/signup`          | Basic email signup             |
| `POST /api/signup/extended` | Signup with name, source, tags |
| `POST /api/signup/bulk`     | Bulk signups (up to 100)       |
| `GET /api/stats`            | Signup statistics              |
| `GET /api/health`           | Health check                   |
| `GET /api/config`           | Configuration info             |
| `GET /api/metrics`          | Prometheus metrics             |

## Technology Stack

- **Runtime**: Bun
- **Framework**: ElysiaJS
- **Validation**: Zod
- **Bot Protection**: Cloudflare Turnstile
- **Storage**: Google Sheets API (REST, no SDK)
- **Auth**: Google service account, JWT signing via `jose`
- **Monitoring**: Prometheus + Pino
- **Testing**: Vitest (unit + integration)
- **Deployment**: Cloudflare Workers via Wrangler

## Links

- [GitHub Repository](https://github.com/briansunter/subs)

## Share this project
