<!-- generated-markdown-alternate -->
---
title: "Yuptime"
description: "A Kubernetes-native uptime monitor. Monitors are CRDs, state lives on the CRD's status subresource, and each check runs in its own throw-away Job pod."
url: "https://briansunter.com/projects/yuptime"
---

Dec 15, 2025

# Yuptime

A Kubernetes-native uptime monitor. Monitors are CRDs, state lives on the CRD's status subresource, and each check runs in its own throw-away Job pod.

[View Source](https://github.com/briansunter/yuptime)

project TypeScript Kubernetes Uptime Monitoring CRD Controller

![Cover image for Yuptime](/_astro/yuptime-hero.DIfs4PH4_1MTYvA.webp)

## Overview

Yuptime is an uptime-monitoring controller where every monitor is a Kubernetes CRD. There’s no database; state lives on each CRD’s status subresource, and every check runs as its own short-lived Job pod, so a misbehaving probe can’t take down the controller. That makes the whole thing GitOps-native: declare your monitors as YAML in a repo, sync with Flux or Argo CD, done.

## Features

- All configuration is YAML in Git; works cleanly with Flux, Argo CD, or any GitOps flow
- No database: state lives on CRD status subresources
- Each check runs in an isolated Kubernetes Job pod
- Prometheus metrics for monitoring and alerting
- Native Alertmanager integration
- Maintenance-window CRDs suppress alerts during planned work

## Monitor Types

### Network

- HTTP: check status code and response body
- TCP: port reachability
- DNS: resolve and validate records
- Ping: ICMP reachability
- WebSocket: connect and exchange a frame

### Application

- Push: heartbeat endpoint for cron jobs and batch processes
- Steam: game-server availability
- Kubernetes: pod and service health inside the cluster

## Architecture

Standard Kubernetes operator pattern:

- Reconcilers for `Monitor`, `MonitorSet`, and `MaintenanceWindow`
- A job manager that schedules and runs checks
- A validation layer that rejects malformed CRDs before they hit the reconciler

## Configuration

yaml

```
apiVersion: yuptime.io/v1
kind: Monitor
metadata:
  name: api-health
spec:
  type: http
  enabled: true
  schedule:
    intervalSeconds: 60
    timeoutSeconds: 30
  target:
    http:
      url: https://api.example.com/health
```

## Technology Stack

- TypeScript on Bun
- Kubernetes client for CRD management
- Custom reconciler framework
- CloudWatch integration for metrics export

## Share this project
