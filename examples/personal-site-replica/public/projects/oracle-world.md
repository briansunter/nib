<!-- generated-markdown-alternate -->
---
title: "Oracle World"
description: "OpenTofu modules for Oracle Cloud's Always Free tier. One `apply` gives you a 4-core ARM box with 24 GB RAM, 200 GB storage, and optional MySQL, S3, monitoring, and budget alerts."
url: "https://briansunter.com/projects/oracle-world"
---

Feb 16, 2026

# Oracle World

OpenTofu modules for Oracle Cloud's Always Free tier. One \`apply\` gives you a 4-core ARM box with 24 GB RAM, 200 GB storage, and optional MySQL, S3, monitoring, and budget alerts.

[View Source](https://github.com/briansunter/oracle-world)

project OpenTofu Terraform Oracle Cloud Infrastructure DevOps

![Cover image for Oracle World](/_astro/oracle-world-hero.DCus1vYT_Zltzn7.webp)

## Overview

Oracle Cloud has the most generous always-free tier of any of the big providers, most notably a 4-core ARM box with 24 GB of RAM that doesn’t time out. The catch is that wiring it up in OCI’s console is unpleasant. Oracle World is the OpenTofu/Terraform code I wrote so I could `tofu apply` myself a working ARM server in one shot, with optional MySQL HeatWave, S3-compatible object storage, idle-detection monitoring, and budget alerts on top.

## Resources

| Resource       | Spec                                                             |
| -------------- | ---------------------------------------------------------------- |
| Compute        | VM.Standard.A1.Flex (4 OCPUs, 24 GB RAM)                         |
| Boot Storage   | 50 GB + weekly backups                                           |
| Block Storage  | 150 GB at `/data`                                                |
| MySQL HeatWave | 50 GB, private subnet (optional)                                 |
| Object Storage | 30 GB S3-compatible (optional)                                   |
| Monitoring     | Idle-detection alarms, so OCI doesn’t reclaim the box (optional) |
| Budget Alerts  | Email on any spend + at 50% / 80% / 100% (optional)              |

## Architecture

![Oracle World cloud infrastructure diagram](/_astro/oracle-world-explainer.CkJRr-ql_1vW4vg.webp)

Oracle World cloud infrastructure diagram

The compute instance sits in a public subnet because OCI NAT gateways aren’t free. MySQL HeatWave, when enabled, lives in a private subnet with no internet route (you reach it via SSH tunnel). SSH is closed by default; whitelist your IP with `just ssh-allow` and revoke with `just ssh-revoke`.

## Features

- One-command deploy: `just init && just plan && just apply`
- Open and close SSH access by IP from the command line
- A Claude Code `/setup` walks you through the variables interactively
- Stays inside Oracle’s Always Free limits by default

## Technology Stack

- HCL (OpenTofu / Terraform)
- Oracle Cloud Infrastructure (OCI)
- Just task runner

## Share this project
