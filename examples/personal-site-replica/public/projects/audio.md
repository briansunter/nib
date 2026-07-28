<!-- generated-markdown-alternate -->
---
title: "Audiobook Player"
description: "A cross-platform audiobook player built with Tauri, Rust, and React. Streams from Google Drive, plays offline, syncs progress, and runs on macOS, Windows, Linux, and iOS."
url: "https://briansunter.com/projects/audio"
---

Mar 15, 2026

# Audiobook Player

A cross-platform audiobook player built with Tauri, Rust, and React. Streams from Google Drive, plays offline, syncs progress, and runs on macOS, Windows, Linux, and iOS.

project Tauri Rust TypeScript React iOS Audiobooks SQLite

![Cover image for Audiobook Player](/_astro/audio-hero.CEvo4_UK_2mR9lL.webp)

## Overview

Audiobook Player is a desktop and iOS audiobook app built with Tauri 2. It connects to Google Drive, detects audiobook folders, downloads chapters for offline listening, and plays them back with the controls you’d expect from a dedicated reader: speed control, skip and seek, bookmarks, sleep timer, and a “continue listening” shelf that picks up exactly where you left off.

I built it because I wanted to listen to my own audiobook collection without uploading it to a third-party service. The files live in a Drive folder I already pay for; this app is the playback layer on top.

![Audiobook Player now-playing screen on iOS](/_astro/audio-now-playing.Du_kLHUl_ZRsjLM.webp)

Audiobook Player now-playing screen on iOS

## Features

### Google Drive integration

- OAuth 2.0 with PKCE, no client secret stored on device
- Browse Drive folders, mark favorites for quick access
- Auto-detect audiobooks from folder structure, including chapter ordering
- Pull metadata from MP3 ID3 tags or MP4 atoms when available
- Cover art from a Drive image, the audio file itself, or picked manually

### Library management

- Local SQLite database for books, chapters, bookmarks, and progress
- Sort by title, author, recently added, or recently played
- Search across the library
- Edit title, author, and narrator after import
- A book wizard walks through detection, metadata, and cover selection on add

### Playback

- Symphonia decoding for MP3, AAC, and ISO MP4 / M4B containers
- Variable speed playback with a curated set of speed presets
- Skip forward / back, fine seek, and gapless chapter transitions
- Bookmarks with timestamps and notes
- Sleep timer
- Native iOS audio session and lock-screen controls via a Swift bridge

### Offline downloads

- Per-chapter downloads with progress events streamed to the UI
- Configurable cache size with eviction
- Clear individual chapters, whole books, or reset progress without re-downloading

### Cross-platform

The same React UI runs on every target. The Rust core handles Drive, the database, the cache, and audio decoding; on iOS, a Swift library plugs into the system audio APIs so playback continues in the background and on the lock screen.

## Technology stack

- Tauri 2 with Rust on the backend, React 19 + TypeScript on the frontend
- Vite, Tailwind CSS v4, shadcn/ui, Radix primitives, lucide-react icons
- `rusqlite` (bundled SQLite) for storage, `symphonia` for decoding, `rodio` for desktop output
- `oauth2` crate with PKCE, `tauri-plugin-deep-link` and `tauri-plugin-web-auth` for the Drive auth flow
- Swift bridge via `swift-rs` for iOS-specific audio session handling
- Targets macOS, Windows, Linux, and iOS 15+

## Share this project
