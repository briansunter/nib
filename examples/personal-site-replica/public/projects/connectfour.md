<!-- generated-markdown-alternate -->
---
title: "Connect Four"
description: "Real-time multiplayer Connect Four with a 3D board. Create a room, share the link, drop pieces."
url: "https://briansunter.com/projects/connectfour"
---

Feb 12, 2025

# Connect Four

Real-time multiplayer Connect Four with a 3D board. Create a room, share the link, drop pieces.

[Visit Project](https://connectfour.briansunter.com)

project React TypeScript Socket.io Three.js PostgreSQL

![Cover image for Connect Four](/_astro/connectfour-hero.BOUWsesO_Z1g9Ewe.webp)

## Overview

A multiplayer Connect Four game I built to learn React Three Fiber and shore up my real-time stack. Players create rooms, share invite codes, and play head-to-head; the board is rendered in 3D so pieces actually drop into the slots.

## Features

- Real-time play over WebSockets
- Rooms with shareable invite codes
- 3D board rendered with React Three Fiber
- Animated piece drops and win highlight
- Mobile-friendly layout

## Technology Stack

- React + TypeScript on the frontend
- Socket.io for the game channel
- Express backend with sessions
- PostgreSQL via Drizzle ORM
- Redis for Socket.io scaling across processes
- Docker Compose for deployment

## How It Works

Players join a room with a short code. Game state lives on the server; every move broadcasts to the room over Socket.io and re-renders for both players. The 3D board is the same React Three Fiber scene on both sides, just with mirrored camera positions.

## Share this project
