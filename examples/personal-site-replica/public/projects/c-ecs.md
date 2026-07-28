<!-- generated-markdown-alternate -->
---
title: "c-ecs"
description: "A tiny single-header C99 entity-component-system for small games and embedded targets, with fixed capacities and no allocation."
url: "https://briansunter.com/projects/c-ecs"
---

May 10, 2026

# c-ecs

A tiny single-header C99 entity-component-system for small games and embedded targets, with fixed capacities and no allocation.

project C ECS Game Development Embedded

![Cover image for c-ecs](/_astro/cecs-hero.DXv4r3fb_ZSQWHH.webp)

## Overview

`c-ecs` is a compact entity-component-system library for small games, toys, and embedded-style programs where allocation and runtime machinery need to stay predictable.

It ships as a single C99 header, uses caller-owned memory, and leans on compile-time capacities instead of heap allocation. The goal is to make the common ECS workflow feel straightforward without bringing in a framework-sized dependency.

## Features

- Drop-in `cecs.h` single-header library
- No heap allocation or external dependencies
- Compile-time capacities for entities, components, resources, and systems
- Type-aware macros for component storage and queries
- Inline query iteration without callback indirection
- Small presets for constrained targets

## Technology Stack

- C99
- Make-based test and benchmark targets
- Nix flake for reproducible development shells

## Share this project
