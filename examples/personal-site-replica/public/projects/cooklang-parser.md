<!-- generated-markdown-alternate -->
---
title: "Cooklang Parser"
description: "A TypeScript parser for Cooklang, the plain-text recipe markup language. Turns .cook files into structured recipe data."
url: "https://briansunter.com/projects/cooklang-parser"
---

Mar 16, 2022

# Cooklang Parser

A TypeScript parser for Cooklang, the plain-text recipe markup language. Turns .cook files into structured recipe data.

[View Source](https://github.com/briansunter/cooklang-parse)

project TypeScript Vitest npm

![Cover image for Cooklang Parser](/_astro/cooklang-parser-hero.CKszzHPX_2ni1Bs.webp)

## Overview

A TypeScript implementation of the Cooklang spec. Cooklang is a plain-text format for recipes (ingredients, cookware, and timers are marked inline with a light syntax), and this parser turns a `.cook` file into a structured object you can render, scale, or feed into a shopping-list builder.

I now use it to power the [recipe section of this site](/recipes).

## Features

- Full spec compliance (ingredients, cookware, timers, metadata)
- Typed output (full TypeScript definitions)
- Parses metadata blocks (servings, prep time, source, etc.)
- Step-by-step parsing with ingredients linked to the steps that use them

## Use Cases

- Recipe sites and apps
- Meal planners
- Shopping-list generators
- Recipe scaling and unit conversion

## Technology Stack

- TypeScript
- Vitest
- Published to npm

## Links

- [Cooklang Specification](https://cooklang.org)

## Share this project
