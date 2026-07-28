<!-- generated-markdown-alternate -->
---
title: "Travel Map"
description: "An interactive map of the countries, US states, China provinces, and cities I have visited, powered by a small YAML travel log."
url: "https://briansunter.com/projects/travel-map"
---

May 10, 2026

# Travel Map

An interactive map of the countries, US states, China provinces, and cities I have visited, powered by a small YAML travel log.

[Visit Project](https://briansunter.com/travel-map)

project Travel Astro TypeScript D3 YAML

![Cover image for Travel Map](/_astro/travel-map-hero.DIFA0vEs_C0wXQ.webp)

## Overview

I wanted a travel page that felt closer to a notebook than a checklist. The map highlights countries I have visited, breaks out individual US states and China provinces, and plots cities as clickable dots so a trip can be read at country, state, province, or city level.

The data lives in a YAML file, which keeps it easy to update without touching the rendering code. The current version tracks 30 countries, 26 US states, 4 China provinces, and 79 cities.

## Features

- Country highlighting across the full world map
- Separate US state highlighting instead of treating the United States as one shape
- Separate China province highlighting instead of treating China as one shape
- Clickable city dots with names and locations
- Drag-to-pan and click-then-scroll zoom behavior
- Labels that appear as the map zooms in
- YAML-backed travel log for cities, states, provinces, and countries

## Technology Stack

- Astro for the static page
- TypeScript for data validation and map state
- D3 geo utilities for projection and path rendering
- TopoJSON datasets for world countries, US states, and China provinces
- YAML for the editable travel log

## Share this project
