<!-- generated-markdown-alternate -->
---
title: "Platform"
description: "A small 2D platformer rendered with isometric 3D models, written in C99 and built on Sokol and a tiny ECS. Same binary runs natively and in the browser via WebAssembly."
url: "https://briansunter.com/projects/platform"
---

May 12, 2026

# Platform

A small 2D platformer rendered with isometric 3D models, written in C99 and built on Sokol and a tiny ECS. Same binary runs natively and in the browser via WebAssembly.

[Visit Project ](https://briansunter.github.io/platform/)[View Source](https://github.com/briansunter/platform)

project C Sokol WebAssembly Game Development ECS

![Cover image for Platform](/_astro/platform-hero.LKJBGtOr_ZdyMb3.webp)

## Overview

Platform is a small side-scrolling platformer written in C99. The world is 2D, but everything on screen is a real 3D mesh from the Kenney Platformer Kit, lit at asset-conversion time so the renderer does no lighting math at runtime.

![Platform gameplay screenshot](/_astro/platform-hero.LKJBGtOr_17LKvC.webp)

Platform gameplay screenshot

The same source builds to a native macOS/Linux binary and to a WebAssembly bundle for the browser, so desktop, mobile web, and a packaged native build all run the same gameplay code.

## Features

- 2D platformer movement with run, jump variable-height jump-cut, and one-way platforms
- Coins, hearts, jewels, stars, keys, and other pickup types
- Touch controls for mobile web: left half for movement, right half to jump
- Deterministic gameplay core split into `game_core.c` with its own unit test suite and 90%+ coverage gate
- Static C mesh data generated from Kenney OBJ models at build time, with no runtime model loading

## Technology Stack

- C99 for all gameplay and rendering code
- [Sokol](https://github.com/floooh/sokol) for graphics, app, and input across Metal, OpenGL, and WebGL2
- [c-ecs](/projects/c-ecs) for entities, components, and systems
- Emscripten for the WebAssembly build
- Python tool that bakes Kenney OBJ meshes into static C arrays
- Nix flake for a reproducible clang + emscripten dev shell

## Share this project
