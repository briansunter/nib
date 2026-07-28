<!-- generated-markdown-alternate -->
---
title: "Paratran"
description: "A CLI, REST API, and MCP server for fast audio transcription on Apple Silicon, built on parakeet-mlx and the Parakeet TDT model."
url: "https://briansunter.com/projects/paratran"
---

Feb 11, 2026

# Paratran

A CLI, REST API, and MCP server for fast audio transcription on Apple Silicon, built on parakeet-mlx and the Parakeet TDT model.

[Visit Project ](https://pypi.org/project/paratran/)[View Source](https://github.com/briansunter/paratran)

project Python MLX Apple Silicon Speech-to-Text CLI MCP FastAPI

![Cover image for Paratran](/_astro/paratran-hero.B5e5F1sU_Zde9Sl.webp)

## Overview

Paratran is a transcription tool for macOS on Apple Silicon. It wraps NVIDIA’s Parakeet TDT model (running through [parakeet-mlx](https://github.com/senstella/parakeet-mlx)) in three interfaces: a CLI for one-off jobs, a REST API for long-running services, and an MCP server so Claude Code or Claude Desktop can transcribe audio as a tool call.

I built it because Whisper is slow on a laptop and most of the fast alternatives are cloud services. The default Parakeet model hits 6.34% average WER across eight English benchmarks, supports 25 languages, and runs roughly 30x faster than Whisper on the same hardware via MLX. It’s fast enough that a one-hour recording transcribes in well under a minute on an M-series chip.

![Paratran architecture diagram](/_astro/paratran-diagram.Cx1Lt_HD_Z2fi5bS.webp)

Paratran architecture diagram

## Features

### CLI

- Transcribe one file or a batch in a single command
- Output as plain text, JSON, SRT, or WebVTT (or all four at once)
- Greedy or beam search decoding with full control over beam size, length penalty, patience, and duration reward
- Chunking for long audio with configurable overlap so sentence boundaries survive joins
- Optional sentence splitting by max words, max duration, or silence gap
- BF16 by default with an `--fp32` flag for environments that need it

### Client mode (no per-file model reload)

The model takes a few seconds to load. Reloading it for every file is wasteful, so the same `paratran` binary doubles as a client: start `paratran serve` once, then point subsequent invocations at it with `-s http://localhost:8000` (or `PARATRAN_SERVER` in the environment) and they hand the file off over HTTP and print the result. The CLI surface is identical either way.

### REST API

A FastAPI server exposes `/health` and `/transcribe`. Upload a wav, mp3, flac, m4a, ogg, or webm file and get back the text plus per-sentence timing and per-token timestamps as JSON. All decoding and sentence-splitting options are query parameters, and interactive docs ship at `/docs`.

bash

```
curl -X POST http://localhost:8000/transcribe -F "file=@recording.m4a"
```

### MCP server

The same package installs `paratran-mcp`, an MCP server that exposes a `transcribe` tool to any MCP client. Stdio is the default (drop a few lines into `.claude/settings.json` and Claude Code can transcribe audio files in-place), and a streamable HTTP transport is available for remote or multi-client setups.

json

```
{
  "mcpServers": {
    "paratran": {
      "command": "uvx",
      "args": ["--from", "paratran", "paratran-mcp"]
    }
  }
}
```

## Quick start

bash

```
# Run without installing
uvx paratran recording.wav

# Or install as a tool
uv tool install paratran
paratran recording.wav

# Start the server once, transcribe many files instantly
paratran serve &
paratran -s http://localhost:8000 --output-format all recording.wav
```

The default model (`parakeet-tdt-0.6b-v3`) downloads on first use into the HuggingFace cache. `--cache-dir` or `PARATRAN_MODEL_DIR` redirects it to an external drive when the local SSD is tight.

## Technology stack

- Python 3.11+, distributed on PyPI as `paratran`
- [parakeet-mlx](https://github.com/senstella/parakeet-mlx) for inference, running on Apple’s MLX framework
- FastAPI and Uvicorn for the REST server
- The official `mcp` Python SDK for the MCP server, with stdio and streamable-HTTP transports
- macOS on M1/M2/M3/M4 (the MLX backend is Apple Silicon only)

## Share this project
