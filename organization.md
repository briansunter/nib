# Nib repository organization

Status: current

Last reviewed: 2026-08-11

Nib keeps one framework package, one optional image package, consumer examples,
and initializer templates in this repository. Static HTML is the default;
browser code is opt-in through DOM enhancements, React islands, or one app
initializer.

## Source ownership

- `src/framework/` owns routing, rendering, Vite integration, builds, islands,
  and publication.
- `src/runtime/` owns the small initial-load enhancement and island runtimes.
- `src/integrations/` contains server-safe plugin declarations.
- `src/internal/` contains generated-entry seams, not consumer APIs.
- Top-level entry files define the package surface.
- `packages/nib-images/` owns Sharp-based image processing.

## Public boundary

`enhance`, `ClientEnhancement`, and `ClientInitializer` come from
`@briansunter/nib`. React-island authoring comes only from
`@briansunter/nib/react`. Filesystem loaders come from `/server`, plugin
contracts from `/plugin`, and generated virtual modules use `/internal/server`,
`/internal/enhancements`, and `/internal/islands`.

Native document navigation is the framework contract. Client-side document
swapping, route remount coordination, idle scheduling, and compatibility
facades for removed browser APIs must not be reintroduced.

## Test ownership

Tests are organized by contract. Architecture tests enforce entry targets and
package contents; fixture and packed-consumer tests prove generated-project
seams; runtime tests cover enhancement cleanup, island hydration, and optional
`src/client.ts` startup; production builds prove route-scoped assets and static
routes with no client runtime.

## Change rule

Prefer deleting duplicated adapters and keeping cohesive modules readable over
adding forwarding layers. Preserve framework ownership of routes, Vite entries,
rendered marker validation, output paths, and publication artifacts.
