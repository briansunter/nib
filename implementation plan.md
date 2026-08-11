# Behavior-first framework redesign

Status: implemented on `refactor/behavior-redesign`

## Target

Nib uses React only to author and prerender static pages. Browser interaction
is attached to existing DOM elements with route-scoped client behaviors.

## Contract

- `<Behavior name="feature">` clones one intrinsic element.
- `feature` maps to `src/behaviors/feature/index.client.ts`.
- The default export is `(root: HTMLElement, signal: AbortSignal) => void | Promise<void>`.
- Startup is immediate or deferred with `idle` or `visible`.
- Visible deferral observes the marked root only.
- Signal abortion is the cleanup mechanism; nested roots clean up deepest first.
- Nib owns `data-nib-behavior` and `data-nib-defer`.
- Behavior CSS is route-linked from its transitive client manifest graph.
- Routes without markers omit the runtime, and projects without behavior
  modules do not build it.
- Client-target Vite hooks still run through a private inert entry when the
  project otherwise has no client input.
- Optional static-document navigation remains supported and remounts behavior
  roots after swaps.

## Removed surfaces

- browser React boundaries, serialization, scheduling, and runtime;
- public generic client runtime and lifecycle helper entries;
- object-shaped behavior context;
- flat `src/behaviors/*.client.ts` discovery;
- framework-authored `data-scheduled` state.

## Acceptance

Typecheck and unit tests must pass. Fixture, scaffold, packed-package, docs, and
blog builds must prove the public package surface. Output tests must cover
static projects, behavior-only routes, behavior-owned CSS, deduplicated
preloads, base paths, and client-target plugin hooks on an otherwise empty
client graph.
