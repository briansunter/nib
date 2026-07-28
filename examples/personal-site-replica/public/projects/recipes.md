<!-- generated-markdown-alternate -->
---
title: "Recipe Collection"
description: "My recipes, written in Cooklang and rendered with a custom Astro integration. Ingredients scale, steps are linked, and everything is plain text on disk."
url: "https://briansunter.com/projects/recipes"
---

Aug 1, 2024

# Recipe Collection

My recipes, written in Cooklang and rendered with a custom Astro integration. Ingredients scale, steps are linked, and everything is plain text on disk.

[Visit Project](https://briansunter.com/recipes)

project Cooklang Astro TypeScript Recipe Management

![Cover image for Recipe Collection](/_astro/recipes-hero.B_5aYGnT_23wiOX.webp)

## Overview

The recipes I cook regularly, written in [Cooklang](https://cooklang.org/). It’s a plain-text markup where ingredients, cookware, and timers are inlined with the steps. I built a small Astro integration that parses the `.cook` files at build time so the site can render them, scale ingredients to any serving size, and let me search by ingredient.

Cooklang means each recipe is a single text file I can edit anywhere, version in git, and parse with [my Cooklang TypeScript parser](/projects/cooklang-parser). No proprietary recipe schema gets between me and dinner.

## Features

- Plain-text Cooklang source (one `.cook` file per recipe)
- Ingredient scaling to any serving count
- Filter by cuisine, dietary tag, or meal
- Search by ingredient or name
- Print-friendly layout
- Typography tuned for reading at arm’s length on a kitchen counter

## Technology Stack

- Cooklang for the source format
- A custom Astro integration that parses `.cook` at build time
- TypeScript
- Tailwind CSS

## Share this project
