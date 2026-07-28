<!-- generated-markdown-alternate -->
---
title: "Bevy Agent"
description: "A Bevy plugin for driving a game as a deterministic simulation that an AI agent can step, inspect, snapshot, restore, replay, and branch."
url: "https://briansunter.com/projects/bevy-agent"
---

May 12, 2026

# Bevy Agent

A Bevy plugin for driving a game as a deterministic simulation that an AI agent can step, inspect, snapshot, restore, replay, and branch.

project Rust Bevy Bevy Plugin ECS Reinforcement Learning Agents Simulation

![Cover image for Bevy Agent](/_astro/bevy-agent-hero.D3V6tuFO_ZlihPI.webp)

## Overview

Bevy Agent is a Bevy plugin that turns a game into a deterministic simulation an external agent can drive tick-by-tick. Drop it into your `App`, register your gameplay state, and the plugin exposes `reset`, `step`, `snapshot`, `restore`, and `branch` over an in-process API, stdio JSON-RPC, HTTP, or WebSocket.

I built it to make Bevy games usable as RL environments and as reproducible test harnesses, without leaving the regular Bevy plugin and ECS model.

![Bevy Agent architecture diagram](/_astro/bevy-agent-diagram.C3X7PS77_Z1cQF54.webp)

Bevy Agent architecture diagram

## Features

- Deterministic stepping via `SimClock` + a dedicated `AgentTick` schedule
- Tier-1 snapshots of every registered resource and component, keyed by `StableEntityId`
- Action logs, checkpoint indexes, and timeline branches for replay and what-if exploration
- Optional headless PNG capture with tick/frame/size metadata
- JSON-RPC over in-process, stdio, HTTP `POST /rpc`, or WebSocket
- Rust API, an `agentctl` HTTP CLI, and a stdlib-only Python client

## Crates

- `bevy_agent_core`: schedules, `SimClock`, domain actions, input frames, observations, rewards, terminal state, checksums
- `bevy_agent_runner`: owns the `App`, exposes the control API and visual capture hooks
- `bevy_agent_snapshot`: snapshots of registered resources and components with stable entity IDs
- `bevy_agent_replay`: action logs, checkpoint indexes, timeline branches
- `bevy_agent_remote`: JSON-RPC bridge with capability and session-token checks
- `sample_platformer`: a headless reference game wired end-to-end into `AgentTick`

## Quick Start

rust

```
use bevy_agent_core::AgentAction;
use bevy_agent_runner::{AgentApp, ResetOptions};

let mut env = AgentApp::new(sample_platformer::build_headless_app);
let obs0 = env.reset(ResetOptions::default())?;
let step1 = env.step(AgentAction::Move { x: 1.0, y: 0.0 })?;
let snapshot = env.snapshot()?;
env.step(AgentAction::Jump)?;
env.restore(snapshot.snapshot_id)?;
let alternate = env.step(AgentAction::Noop)?;
```

Drive it from Python over HTTP:

python

```
from bevy_agent_client import AgentClient

env = AgentClient("http://127.0.0.1:4000/rpc")
obs = env.reset(seed=42)
step = env.step({"type": "Move", "x": 1.0, "y": 0.0})
snapshot = env.snapshot()
env.restore(snapshot["snapshot_id"])
```

## Determinism Contract

Gameplay systems that want replayable behavior should:

- run in `AgentTick`, not the ordinary frame `Update`
- read `SimClock`, not wall-clock `Time`
- consume `CurrentInputFrame<AgentAction>`, not keyboard or mouse state directly
- use `StableEntityId` for semantic entity identity
- register all gameplay state with `SnapshotAppExt`
- keep rendering and UI systems read-only with respect to authoritative state

## Technology Stack

- Rust 2024 edition, Bevy 0.18
- Custom `AgentTick` schedule for deterministic stepping
- JSON-RPC transports: in-process, stdio, HTTP, WebSocket
- `image` crate for PNG capture
- Python client built on the standard library, no extra deps

## Share this project
