<!-- generated-markdown-alternate -->
---
title: "CuckooTimer"
description: "A 3D cuckoo-clock that lives in your macOS menu bar. Every 30 minutes the doors swing open and a tiny bird reminds you the morning is gone."
url: "https://briansunter.com/projects/cuckootimer"
---

Jul 20, 2025

# CuckooTimer

A 3D cuckoo-clock that lives in your macOS menu bar. Every 30 minutes the doors swing open and a tiny bird reminds you the morning is gone.

[Visit Project](https://cuckootimer.com)

project Rust Tauri React Three.js TypeScript macOS 3D

![Cover image for CuckooTimer](/_astro/cuckootimer-hero.B4CXuy1l_1HulXE.webp)

## Overview

CuckooTimer is a macOS menu-bar app that exists for one reason: I wanted a cuckoo clock without owning a real cuckoo clock. It hides in the menu bar, ticks quietly in the background, and on a configurable interval (15, 30, or 60 minutes) pops open a little 3D scene where the doors swing open and the bird sings. Then it tucks itself away again.

It’s a stretch to call it a productivity tool. It’s a pleasant interruption.

## Features

- Lives in the menu bar; no Dock icon
- Animated 3D scene with procedural wood, swinging pendulum, opening doors, and a bird that pops out
- Intervals of 15, 30, or 60 minutes
- Three modes: appear only on cuckoo, always visible, or sound only
- Working-hours window so it doesn’t chirp at you on a Sunday morning
- Optional ticking and chirp sounds
- Self-hosted update channel
- $3.99 one-time purchase, no subscription

## How It Works

Set the interval. The Rust backend tracks time in the background. When the timer fires, the doors animate open, the bird emerges, the chirp plays, and the window auto-hides after the animation. That’s the whole loop.

## Technology Stack

- **Desktop App**: Rust with Tauri 2.0 for native macOS integration
- **3D Rendering**: Three.js with WebGPU and TSL (Texture Shader Language) for the procedural wood
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Website**: TanStack Start (SSR), PostgreSQL via Drizzle ORM
- **Monorepo**: pnpm workspaces (`@cuckoo/app`, `@cuckoo/site`, `@cuckoo/ui`)
- **Payments**: Stripe
- **Hosting**: DigitalOcean Spaces for builds and updates

## Share this project
