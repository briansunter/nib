<!-- generated-markdown-alternate -->
---
title: "Pin Collection"
description: "A digital display case for my lapel-pin collection. Each pin is photographed, background-removed, and pinned (sorry) to a velvet-style backdrop with notes on where it came from."
url: "https://briansunter.com/projects/pin-collection"
---

Aug 1, 2024

# Pin Collection

A digital display case for my lapel-pin collection. Each pin is photographed, background-removed, and pinned (sorry) to a velvet-style backdrop with notes on where it came from.

[Visit Project](https://briansunter.com/pin-collection)

project Collection Astro TypeScript rembg Python

![Cover image for Pin Collection](/_astro/pin-collection-map-hero.BmWpjOwj_Z2l6GXi.webp)

## Overview

I collect lapel pins from museums, events, friends, and random vending machines, and the box of them was getting unwieldy. So I started photographing each one, running the photos through [rembg](https://github.com/danielgatis/rembg) to drop the background, and putting them on this page with notes on the provenance, materials, and where I picked them up.

It’s a digital version of the felt-board displays you see at pin-trading conventions, with the bonus that I can search and filter without touching the physical pile.

## Map View

The collection also has a map view for pins with known coordinates. It turns the collection into a loose travel diary: brewery pins, museum pins, gifts, national parks, and roadside finds all land back where I picked them up.

![Pin collection world map view](/_astro/pin-collection-map-hero.BmWpjOwj_Z1B5OR1.webp)

Pin collection world map view

Zooming in keeps the pin artwork front and center while labels appear only where they can fit. The result feels more like browsing a physical display case than scanning a spreadsheet of places.

![Pin collection North America map view](/_astro/pin-collection-map-north-america.Bb91_D8J_2i7Y2V.webp)

Pin collection North America map view

## Features

- Felt-style backdrop with each pin floating on a soft drop shadow
- Click for a detail modal with full metadata and prev/next nav
- Map view for pins with known coordinates
- Cluster-aware map labels and thumbnail markers
- Background-removal pipeline using Python’s `rembg` with the BiRefNet model
- Filter by category, material, tag, or favorite
- Sort by acquisition date, name, or category
- Horizontal timeline of when each pin entered the collection
- Stats (top categories, year-over-year additions, top tags)
- Keyboard navigation; deep links via hash routing

## Technology Stack

- YAML files for pin metadata
- Python `rembg` (BiRefNet model) for background removal
- Astro for static generation
- Leaflet for the interactive map view
- Tailwind CSS, TypeScript

## Share this project
