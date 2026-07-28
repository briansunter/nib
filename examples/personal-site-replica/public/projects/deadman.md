<!-- generated-markdown-alternate -->
---
title: "Deadman"
description: "A dead-man's switch for Prometheus / Alertmanager, running on Cloudflare Workers and Durable Objects. Alerts you when your monitoring goes silent."
url: "https://briansunter.com/projects/deadman"
---

Mar 8, 2026

# Deadman

A dead-man's switch for Prometheus / Alertmanager, running on Cloudflare Workers and Durable Objects. Alerts you when your monitoring goes silent.

[View Source](https://github.com/briansunter/deadman)

project TypeScript Cloudflare Workers Durable Objects Prometheus Alertmanager Monitoring

![Cover image for Deadman](/_astro/deadman-hero-card.FPcVQcyU_ZFuKRN.webp)

## Overview

Prometheus can’t alert you about itself. If the whole observability stack falls over, Alertmanager isn’t going to send you the alert that says “Alertmanager is down.” Deadman is the dead-man’s switch that lives outside it: Alertmanager sends a periodic Watchdog heartbeat to Deadman, and if that heartbeat stops arriving, Deadman pages you.

It runs on Cloudflare Workers + Durable Objects, so it’s on completely independent infrastructure from whatever you’re monitoring.

## How It Works

![Deadman alert pipeline diagram](/_astro/deadman-explainer.DoYt8kEb_ZVoO67.webp)

Deadman alert pipeline diagram

1. **Heartbeat**: Alertmanager sends a Watchdog alert to Deadman every minute, resetting a countdown timer (default 5 min).
2. **Alert**: If the timer expires with no heartbeat, Deadman fires notifications on every configured channel (Discord, Slack, Telegram, Email). Re-alerts on a cooldown (default 15 min).
3. **Recovery**: When heartbeats resume after an alert, Deadman sends a recovery notification.

The whole switch is a single Durable Object. Each heartbeat schedules a DO alarm via `setAlarm()`, and Cloudflare handles the persistence and timing in the DO’s SQLite storage (no polling, no cron, no always-on workers).

## Features

- Discord, Slack, Telegram, and Cloudflare Email Routing
- No always-on processes (Durable Object alarms do all the scheduling)
- One-click Workers deploy or via Wrangler CLI
- Configurable heartbeat timeout and re-alert cooldown
- Templated alert messages
- Endpoints for health, status, webhook, ping, and reset

## Technology Stack

- TypeScript on Cloudflare Workers + Durable Objects
- Zod for runtime validation
- Bun for local dev and tests
- Wrangler for deployment

## Share this project
