<!-- generated-markdown-alternate -->
---
title: "TRAD Strike"
description: "A small Raiden Trad-inspired vertical shooter written in C99, built on Sokol and a tiny ECS. The same binary runs natively and in the browser via WebAssembly."
url: "https://briansunter.com/projects/trad"
---

May 12, 2026

# TRAD Strike

A small Raiden Trad-inspired vertical shooter written in C99, built on Sokol and a tiny ECS. The same binary runs natively and in the browser via WebAssembly.

[Visit Project ](https://briansunter.github.io/trad/)[View Source](https://github.com/briansunter/trad)

project C Sokol WebAssembly Game Development ECS

![Cover image for TRAD Strike](/_astro/trad-hero.DWOM3tTK_O9wsP.webp)

## Overview

TRAD Strike is a small vertical shoot-‘em-up inspired by Raiden Trad, written in C99. The view is top-down and 2D, but every ship, projectile, and prop on screen is a real 3D mesh from the Kenney Space Kit, lit at asset-conversion time so the renderer does no lighting math at runtime.

![TRAD Strike gameplay screenshot](/_astro/trad-hero.DWOM3tTK_Z2eIlWH.webp)

TRAD Strike gameplay screenshot

The same source builds to a native macOS/Linux binary and to a WebAssembly bundle, so desktop and mobile web both run the same gameplay code as the native build.

## Features

- Wave-based vertical shooter with enemy waves, projectiles, particles, and pickups
- ECS layout with `spawn`, `player`, `enemy`, `movement`, `collision`, `lifetime`, and `cleanup` systems
- Desktop input via WASD/arrows, Space/Z/X to fire, R to restart, mouse aim
- Mobile touch controls: left half is a d-pad, right half is the fire button
- Parallax starfield and alpha-blended glow effects rendered through Sokol GL immediate-mode
- Static C mesh data generated from Kenney OBJ models at build time, with no runtime model loading

## Technology Stack

- C99 for all gameplay and rendering code
- [Sokol](https://github.com/floooh/sokol) for graphics, app, and input across Metal, OpenGL, and WebGL2
- [c-ecs](/projects/c-ecs) for entities, components, and systems
- Emscripten for the WebAssembly build
- Python tool that bakes Kenney OBJ meshes into static C arrays
- Nix flake for a reproducible clang + emscripten dev shell

## Share this project
