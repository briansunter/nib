<!-- generated-markdown-alternate -->
---
title: "Kungfu"
description: "A library of reusable skills (prompts plus references and templates) that any Agent Skills–compatible coding agent can install and use."
url: "https://briansunter.com/projects/kungfu"
---

Jan 23, 2026

# Kungfu

A library of reusable skills (prompts plus references and templates) that any Agent Skills–compatible coding agent can install and use.

[View Source](https://github.com/briansunter/kungfu)

project TypeScript Python Claude AI MCP SaaS

![Cover image for Kungfu](/_astro/kungfu-hero.C3FnWX7G_6PIMF.webp)

## Overview

Kungfu is a collection of skills (structured prompts bundled with reference material, templates, and small helper scripts) that any agent supporting the Agent Skills format can install. Claude Code, Cursor, Windsurf, and anything else that loads skills can pick them up and run them.

Skills cover the kinds of one-off business and SaaS tasks I keep ending up doing by hand: validating an idea, picking a domain, drafting pricing pages, writing a Show HN, reading SaaS metrics. Each one packages the prompts and the supporting files an agent actually needs to get a useful answer.

## Features

- 16 skills across idea validation, pricing, retention, launches, legal, and metrics
- Each skill is a self-contained directory: instructions, references, templates, and optional scripts
- Works with any Agent Skills–compatible host
- Install with `npx skills add kungfu/<skill-name>`
- CI runs type-checks, lint, format, and skill validation on every push

## Available Skills

Idea-finding, domain-name discovery, pricing-page design, launch playbooks, SaaS-metrics analysis, retention plays, community growth, lead research, legal-doc generation, solo-founder ops, and a handful of others.

## Technology Stack

- TypeScript and Python for validation and code-gen helpers
- Bun runtime
- Just for tasks
- Biome and Prettier for formatting
- GitHub Actions for CI

## Share this project
