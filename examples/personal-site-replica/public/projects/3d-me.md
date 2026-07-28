<!-- generated-markdown-alternate -->
---
title: "3D Me: 3D Selfie"
description: "I had myself body-scanned at a 3D-printing kiosk in San Francisco, then loaded the resulting mesh into a three.js scene so you can spin it around in the browser."
url: "https://briansunter.com/projects/3d-me"
---

Jun 23, 2019

# 3D Me: 3D Selfie

I had myself body-scanned at a 3D-printing kiosk in San Francisco, then loaded the resulting mesh into a three.js scene so you can spin it around in the browser.

[Visit Project ](https://briansunter.github.io/3D-me/)[View Source](https://github.com/briansunter/3D-me)

project JavaScript three.js WebGL 3D Photogrammetry

![Cover image for 3D Me: 3D Selfie](/_astro/3d-me-hero.CaqVnWVy_2aXXjf.webp)

## Overview

3D Me is an interactive viewer for a real, full-body 3D scan of myself. The mesh came from a body-scan kiosk; this project loads the exported model into a three.js scene so anyone can pan, zoom, and orbit around it in the browser. It’s the same asset I had printed as a miniature figurine, just rendered live in WebGL instead of resin.

## Background

A new store called Pocket Me opened in San Francisco’s Fisherman’s Wharf with a single pitch: step into a booth, get scanned by a ring of cameras, and walk away with a realistic miniature 3D-printed figurine of yourself. The end product looks like a custom action figure.

What got me through the door wasn’t the figurine; it was the source asset. A booth like that produces a high-resolution, fully-textured mesh of a human body, and once I had a copy I wanted to use it for more than a printed statue. Specifically, I wanted to drop it into the browser as a real-time 3D object, and to have something on hand for game and AR experiments.

## What it does

- Loads my scanned mesh into a three.js scene
- Orbit controls so you can rotate, pan, and zoom around the model
- Lighting set up so the textured surface reads cleanly from any angle
- Runs entirely in the browser: no plugin, no install, no server-side rendering
- Deployed to GitHub Pages, so the demo URL is the same as the source repo

## How the scan was captured

The Pocket Me booth uses a multi-camera photogrammetry rig: dozens of synchronized cameras fire at once to capture the subject from every angle, and the software stitches those photos into a single textured mesh. The output is a watertight model with a baked color texture: good enough to print at miniature scale, and good enough to render in a browser without any cleanup.

## Technology

- [three.js](https://threejs.org/) for the WebGL scene, camera, and orbit controls
- A standard glTF / OBJ-style mesh + texture as the input asset
- Plain JavaScript, no framework; the whole thing is small enough that a render loop and a model loader is most of the source
- Built and deployed to GitHub Pages out of the `docs/` folder

## Running it locally

bash

```
npm start              # dev server
npm run build          # production build
npm run build:pages    # build into docs/ for GitHub Pages
```

## Why I keep it around

A textured human-body mesh is a surprisingly useful prop. I’ve reused this asset in three.js sketches, AR experiments, and as a stand-in character for game prototypes. The viewer page is mostly a way to show off what the booth produces and to keep the model loadable from a permanent URL, much easier than passing around a multi-hundred-megabyte file.

## Share this project
