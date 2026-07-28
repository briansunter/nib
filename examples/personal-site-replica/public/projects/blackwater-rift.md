<!-- generated-markdown-alternate -->
---
title: "Blackwater Rift"
description: "A monochrome top-down shooter for the original Game Boy, with a browser shell that runs the same ROM on desktop and mobile."
url: "https://briansunter.com/projects/blackwater-rift"
---

May 10, 2026

# Blackwater Rift

A monochrome top-down shooter for the original Game Boy, with a browser shell that runs the same ROM on desktop and mobile.

[Visit Project ](https://briansunter.github.io/blackwater-rift/)[View Source](https://github.com/briansunter/blackwater-rift)

project Game Boy GBDK C JavaScript Vite

![Cover image for Blackwater Rift](/_astro/blackwater-rift-hero.BSRJcLS7_26wJUG.webp)

## Overview

Blackwater Rift is a small top-down shooter built as a real Game Boy ROM and wrapped in a browser player. The browser version uses the same `.gb` file, so the page is a playable shell around the hardware-targeted build rather than a remake.

![Blackwater Rift running in the browser Game Boy shell](/_astro/blackwater-rift-hero.BSRJcLS7_ZGaW0w.webp)

Blackwater Rift running in the browser Game Boy shell

The game is designed around compact arcade loops: readable enemy waves, charge shots, bombs, pickups, stage bosses, and a password flow that works on original hardware.

![Blackwater Rift title screen in the browser Game Boy shell](/_astro/blackwater-rift-title.DqU1AUpH_Z5utQL.webp)

Blackwater Rift title screen in the browser Game Boy shell

The screenshots below come from the project repo’s generated screenshot set, which makes it easier to compare title, gameplay, and stage coverage as the ROM changes.

![Contact sheet of Blackwater Rift stages and bosses](/_astro/blackwater-rift-contact-sheet.CGLVJIOA_YI6kd.webp)

Contact sheet of Blackwater Rift stages and bosses

## Features

- Monochrome top-down shooter targeting the original Game Boy
- Browser shell for desktop keyboard play and mobile touch controls
- Six stages with enemy waves, bosses, pickups, bombs, and charge shots
- Password and save flow backed by SRAM on the ROM side and local storage in the browser shell
- Host-side tests for portable game logic

## Technology Stack

- GBDK-2020 and SDCC for the ROM build
- C99 for gameplay logic
- Vite for the browser shell
- `gameboy-emulator` for web playback
- Shell scripts and generated screenshots for release checks

## Share this project
