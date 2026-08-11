# Nib repository organization

Status: current

Last reviewed: 2026-08-11

Nib keeps one framework package, one optional image package, consumer examples,
and initializer templates in this repository. The browser architecture is
behavior-only; server/build-time React remains an implementation dependency.

## Source ownership

- `src/framework/` owns routing, rendering, Vite integration, builds, and
  publication.
- `src/runtime/` owns the behavior runtime and shared runtime coordinator.
- `src/navigation/` owns optional static-document navigation.
- `src/integrations/` contains server-safe plugin declarations.
- `src/internal/` contains generated-entry seams, not consumer APIs.
- `src/index.ts`, `src/server.ts`, `src/plugin.ts`, and other top-level entry
  files define the package surface.
- `packages/nib-images/` owns all Sharp-based processing.

## Public boundary

Universal authoring APIs, including `Behavior` and `ClientBehavior`, come from
`@briansunter/nib`. Filesystem loaders come from `/server`, plugin contracts
from `/plugin`, and the explicitly configured browser navigation controller
from `/client/navigation`. Generated virtual modules use `/internal/server` and
`/internal/client`.

The removed browser React and generic lifecycle entry points must not be
reintroduced as compatibility facades. New public abstractions require a
second concrete consumer and an execution-target review.

## Test ownership

Tests remain organized by contract rather than mirroring every implementation
folder. Architecture tests enforce entry targets and package contents; fixture
and packed-consumer tests prove the generated-project seam; browser/runtime
tests cover behavior scheduling, cleanup, and optional navigation.

## Change rule

Prefer deleting duplicated adapters and keeping cohesive modules readable over
adding forwarding layers. Preserve framework ownership of routes, Vite entries,
behavior markers, output paths, and publication artifacts.
