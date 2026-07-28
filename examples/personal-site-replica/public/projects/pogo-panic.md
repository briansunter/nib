<!-- generated-markdown-alternate -->
---
title: "Pogo Panic"
description: "A tiny Game Boy arcade platformer built with GBDK-2020. You're always bouncing on a pogo stick: steer, stomp cracked blocks, grab the battery, reach the exit."
url: "https://briansunter.com/projects/pogo-panic"
---

Mar 31, 2026

# Pogo Panic

A tiny Game Boy arcade platformer built with GBDK-2020. You're always bouncing on a pogo stick: steer, stomp cracked blocks, grab the battery, reach the exit.

[Visit Project ](https://briansunter.github.io/pogo-panic/)[View Source](https://github.com/briansunter/pogo-panic)

project Game Boy GBDK-2020 C Vite Game Dev

![Cover image for Pogo Panic](/_astro/pogo-panic-hero.BCCfAwIN_2l94lV.webp)

## Overview

Pogo Panic is a real DMG Game Boy game. The player is always bouncing on a pogo stick; you can’t stop, only steer. The build is a 32 KB ROM compiled with GBDK-2020 that runs unmodified on original hardware, flashcarts, and standalone emulators. A small Vite browser runner loads the same `.gb` file through `gameboy-emulator` so anyone can try it without a flashcart.

The ROM is the canonical artifact: gameplay rules, level generation, save handling, and music all live in C. The browser shell is treated as a demo and never re-implements game logic.

![Pogo Panic Adventure room gameplay screenshot](/_astro/pogo-panic-gameplay.qWGDVOqc_ZYUrMI.webp)

Pogo Panic Adventure room gameplay screenshot

## Gameplay

- Steer left and right; you can’t stop bouncing
- **A** stomps to break cracked blocks and rocks
- **B** tilts for a short hop
- Collect the golden battery, then reach the exit door

## Modes

- **Adventure**: 80 curated fixed rooms with SRAM-backed unlocks
- **Panic**: endless procedurally generated rooms with rising hazard pressure
- **Time Trial**: race the Adventure rooms with a best-time record per room

## Technology Stack

- C with GBDK-2020 targeting the DMG (Game Boy) CPU
- Vite + `gameboy-emulator` for the browser runner
- Node’s built-in `node:test` for ROM and web-module smoke tests
- SRAM for save data (Adventure unlocks, best times, Panic best depth)

## How It Works

`src-rom/main.c` is the full game: gameplay, level generation, menus, 4-channel music, and rendering. `make` compiles it to `dist/pogo-panic.gb` and copies the ROM into `public/roms/` so the browser shell can fetch it. The web side is strictly host code: emulator boot, input mapping, SRAM persistence, and a level debug viewer that consumes JSON dumped from the C source. The constraint that everything must run on a real DMG keeps scope honest: 160×144 screen, 4-color palette, fixed-tick bounce physics.

## Share this project
