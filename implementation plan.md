# Nib behavior simplification implementation plan

Status: Implemented locally. The framework and consumer changes, verification,
and representative preview smoke checks are complete; publishing or promoting
Nib `0.20.0` remains a separate approved release action.

Date: 2026-07-30

Scope:

- Framework: `/Volumes/Storage/code/nib`
- Consumer: `/Volumes/Storage/code/personal-site-nib`

The requested `../nib-personal-site` path is not present in this checkout. The
actual sibling consumer is `../personal-site-nib`, and this plan uses that
repository as the source of truth for the framework changes.

## Objective

Simplify Nib interactivity around one rule:

> A behavior is one imperative enhancement attached directly to one existing
> DOM element.

Keep Nib static-first. Nib should own the marker, client-entry loading,
immediate or explicitly deferred startup, AbortSignal lifetime,
client-navigation remounting, behavior/island safety, and route-specific
asset loading. The personal site should own Pagefind, PhotoSwipe, Leaflet,
Cooklang, filtering policy, URL policy, analytics, and feature state.

The target release is Nib `0.20.0`. The package and source now report `0.20.0`,
and the behavior compatibility aliases have been removed. Publishing remains
separate from this implementation work.

## Target authoring model

Collapse `Behavior`, `LazyBehavior`, and `Enhance` into one wrapper-free
`Behavior` component:

```tsx
<Behavior name="project-filter">
  <div className="projects-index">
    ...
  </div>
</Behavior>

<Behavior name="travel-map" defer="visible">
  <section className="travel-map-panel">
    ...
  </section>
</Behavior>
```

Contract:

| Property | Contract |
| --- | --- |
| `name` | Resolves `src/behaviors/<name>.client.*`. |
| `defer` | Optional `idle` or `visible`; omitted means immediate startup. |
| `children` | Required, exactly one existing element. The marker is placed on that element. |
| `props` | Removed from the behavior contract. Client functions receive only `root` and `signal`. |

Generated markup:

```html
<div data-nib-behavior="project-filter">
  ...
</div>

<section
  data-nib-behavior="travel-map"
  data-nib-defer="visible"
>
  ...
</section>
```

Do not call behavior startup hydration. New output and documentation must use
`data-nib-behavior` and `data-nib-defer`, not `data-hydrate` or a custom
`<nib-behavior>` wrapper. The old behavior wrapper protocol is no longer
scanned; `data-hydrate` remains an island-only protocol.

Client modules become ordinary typed functions:

```ts
import type { ClientBehavior } from '@briansunter/nib/client'

export default (({ root, signal }) => {
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-project-tag]')
  for (const button of buttons) {
    button.addEventListener('click', () => {
      // Update only this behavior's root.
    }, { signal })
  }
}) satisfies ClientBehavior
```

The public client contract should reduce to:

```ts
export interface BehaviorContext {
  root: HTMLElement
  signal: AbortSignal
}

export type ClientBehavior = (
  context: BehaviorContext,
) => void | Promise<void>
```

There are no behavior compatibility aliases. `behavior()`, `BehaviorMount`,
`BehaviorMountContext`, and `BehaviorCleanup` are removed; new client modules
use the plain `ClientBehavior` function type.

## Ownership and composition rules

Behaviors are attachments, not React-style exclusive subtree owners. The
framework must validate ownership as follows:

| Outer / inner owner | Result |
| --- | --- |
| Behavior inside behavior | Allowed. Each behavior receives its own marked element and signal. |
| Behavior inside island | Rejected. |
| Island inside behavior | Rejected. |
| Island inside island | Preserve the existing island composition rules. |
| Multiple behaviors on the exact same element | Reject initially. |

Nested behaviors must be independent. A behavior must not replace or remove
another behavior's root element, and feature code must not use the parent root
as permission to query the document globally. `window` and `document` remain
valid only for genuinely global concerns such as scroll, resize, Escape,
history, body classes, or modal presentation.

## Work sequence

The phases are ordered. Phase 1 unlocks honest page roots, Phase 2 makes the
runtime safe for the migration, and Phase 3 is the consumer migration. Phase 4
deletes app abstractions. Phase 5 is the public API and release cleanup.

### Phase 0: Baseline and inventory

Before changing behavior contracts:

1. Record the current Nib and personal-site commits, package versions, and
   clean/dirty state.
2. Run each repository's declared verification command and retain the results:
   `bun run verify` in Nib and `bun run verify` in personal-site-nib.
3. Inventory all behavior markers, `Behavior`/`LazyBehavior`/`Enhance` uses,
   `behavior()` imports, `data-hydrate`, `<nib-behavior>`, and `.client.*`
   discovery tests.
4. Capture representative rendered HTML for shell, project, recipe, search,
   gallery, article, pin, and travel routes.

Do not treat the existing partial API migration or a passing baseline as proof
that the new model is implemented.

### Phase 1: Correct Nib composition and the behavior contract

Primary files:

- `src/framework/behaviors.tsx`
- `src/framework/client-ownership.ts`
- `src/framework/islands.tsx`
- `src/framework/project-renderer.ts`
- `src/runtime/behaviors.ts`
- `src/client.ts`
- `src/client/behaviors.ts`
- `src/framework/behavior-paths.ts`
- `src/framework/project-vite-plugin.ts`
- `src/framework/build/site.ts`
- `src/framework/client-mount-scheduler.ts`

Implementation:

1. Make `Behavior` require exactly one `ReactElement` child and clone that
   element with `data-nib-behavior` and optional `data-nib-defer` attributes.
2. Replace `when` with optional `defer`. Omission means immediate startup;
   `idle` and `visible` are the only deferred values. Legacy behavior `when`
   output is not translated or accepted.
3. Stop emitting `style="display: contents"`, `data-props="{}"`, and custom
   behavior wrapper elements.
4. Allow behavior ownership context to pass through another behavior. Continue
   rejecting behavior/island overlap in both directions. Add explicit
   detection for two behavior markers on one exact element.
5. Rename shared validation and error messages away from `validateIslandId`
   and hydration-strategy terminology for behavior-specific failures.
6. Keep the runtime loader/cache/abort architecture. Change only the boundary
   and naming: each module receives `{ root, signal }`, and its root is the
   marked element itself.
7. Start immediate behavior module loading directly. Do not add an extra
   `queueMicrotask()` delay before beginning an immediate import.
8. Add route-generated module-preload links for immediate behaviors present on
   the current route. Do not preload `defer="idle"` or `defer="visible"`
   behaviors.
9. Narrow discovery back to `/src/behaviors/**/*.client.*`. Do not make every
   `.client.*` file under `src` a behavior entry.

Tests required in this phase:

- SSR emits a marker on the real element and preserves its children.
- Missing children, multiple children, invalid names, and invalid defer values
  fail closed.
- Nested behavior markers render and validate successfully.
- Every behavior/island overlap direction fails with a useful error.
- Multiple behaviors on one exact element fail deterministically.
- Immediate and deferred entries produce the correct preload and scheduling
  behavior.
- Old `<nib-behavior>` markup is ignored by the behavior runtime and is not a
  supported behavior protocol.

### Phase 2: Harden lifecycle helpers and plugin bootstrap

Primary files:

- `src/runtime/behavior-utils.ts`
- `src/runtime/behaviors.ts`
- `src/framework/project-vite-plugin.ts`
- `src/framework/extensions/contracts.ts`
- `src/plugin.ts`
- `package.json`

#### Lifecycle helpers

Keep only lifecycle primitives in the public Nib lifecycle subpath:

```ts
import {
  debounce,
  waitForElement,
  observeMutations,
  loadScript,
} from '@briansunter/nib/client/lifecycle'
```

Move these site-policy helpers out of Nib:

- `setParams()`
- `splitTags()`
- `reflectButtonGroup()` / `setPressed()`
- the `on()` alias, unless a real second consumer demonstrates a need for it

Use native signal-bound listeners in site code:

```ts
button?.addEventListener('click', handler, { signal })
```

Correctness fixes:

1. `onScroll`: retain the scheduled animation-frame ID, cancel it on abort,
   and check `signal.aborted` inside the callback.
2. `later`: return immediately for an already-aborted signal, before creating
   a timer.
3. `waitForElement`: reject immediately when already aborted; remove the abort
   listener after successful resolution; disconnect the observer on success and
   abort.
4. `loadScript`: cache a shared, signal-independent resource-load promise.
   Race each caller's promise against that caller's signal. Do not delete a
   successful shared load from the cache.

The intended `loadScript` shape is:

```ts
const sharedLoads = new Map<string, Promise<void>>()

function sharedScriptLoad(src: string): Promise<void> {
  // Create once and cache independently of any behavior signal.
}

export function loadScript(
  src: string,
  { signal }: { signal: AbortSignal },
): Promise<void> {
  const load = sharedLoads.get(src) ?? createAndCacheLoad(src)
  return raceWithAbort(load, signal)
}
```

Add tests for already-aborted callers, concurrent callers where one aborts,
successful cache reuse, observer cleanup, timer cleanup, and queued-frame
cleanup.

#### Plugin client bootstrap

The plugin `clientEntries` contract is a legitimate application-lifetime
bootstrap scope, but it should use the same lifecycle language as behaviors:

```ts
export function initialize(signal: AbortSignal): void
```

Change the generated client bootstrap to own one `AbortController` and abort
it on HMR and application teardown. Remove the dual returned-cleanup model
(`void | (() => void)` or `{ destroy() }`) from new contracts. Rename the
internal "enhancement entry" to "client bootstrap entry" so it is not confused
with the removed `Enhance` component.

### Phase 3: Migrate personal-site behavior roots

Every route behavior must accept `{ root, signal }` and begin selectors at
`root`. Remove empty behavior markers. Keep global queries only where the
feature truly owns global state, and document those exceptions.

| Feature | Current boundary | Target boundary and work |
| --- | --- | --- |
| Site shell | Empty `shell` marker at the bottom of `src/site-shell.tsx`; `shell.client.ts` searches the document. | Wrap the existing `.site-frame` in `<Behavior name="shell">`. Change `initSiteShell(signal)` to `initSiteShell(root, signal)`. Scope header, mobile navigation, social controls, newsletter forms, footer, and back-to-top queries to `root`. Keep only scroll, resize, Escape, body, and history effects global. |
| Project filter | `src/pages/projects/page.tsx` inserts an empty marker inside the project root; `project-filter.client.ts` finds `[data-project-browser]` globally. | Attach `project-filter` to the complete `.projects-index` / project browser element. Query filters, status, cards, and section counts through `root`. Remove `data-project-browser` unless CSS or tests still need it. |
| Recipe index | `recipe-filter` wraps only an inner filter/list fragment. | Make the existing `section[data-recipe-list]` the behavior root, including filters, cards, results state, and empty state. Keep this as the canonical Nib example. |
| Recipe detail | `RecipeControls` owns a small wrapper while `recipe-controls.client.ts` reaches `document` for ingredients, steps, and controls. | Remove the framework import from `src/components/RecipeControls.tsx`. Add `recipe-detail` around the complete recipe detail root in `src/data-pages.tsx`. Move scale, units, ingredient updates, step updates, and recipe-only copy attachment into `recipe-detail.client.ts`. Keep quantity and conversion functions pure and app-owned. |
| Search | `search` wraps the Pagefind root while the empty state is outside it; `search.client.ts` queries the document. | Attach search to the complete `.search-page`, including Pagefind, popular topics, recent writing, and empty state. Keep Pagefind loading, URL synchronization, result enhancement, and cleanup in the app. Put the generated Pagefind stylesheet in the page head or adapter rather than using a wrapper to load it. |
| Photo and art galleries | `Gallery` puts `photo-gallery` or `art-gallery` around only the toolbar; gallery modules find the grid and maps globally. | Attach the behavior to the outer gallery page root in `src/components/Gallery.tsx`, `src/pages/photos/page.tsx`, and `src/pages/art/page.tsx`. Pass `root` to `initPhotoSwipe`, `initPhotoNav`, masonry, and map initialization. Keep `gallery/lightbox.ts`, navigation, masonry, Leaflet adapters, and caption helpers as separate real responsibilities. Start the behavior immediately; lazy-load expensive maps and PhotoSwipe internally. |
| Content enhancements | `src/layouts/article.tsx` renders prose, then adds an empty enhancement marker. | Attach `content-enhancements` to the article. Scope autoplay observation, prose lightbox, and delegated code-copy listeners to `root`. Keep the shared PhotoSwipe/history lifecycle helper. Apply the same root to data-page article output in `src/data-pages.tsx`. |
| Travel map | `TravelMap` wraps a section, but the client entry ignores it, mutates `body`, and resolves the map by global ID. | Attach `travel-map` to the section in `src/components/TravelMap.tsx` with `defer="visible"`. Find the map container under `root` and call `initTravelMap(container, signal)`. Render page/body presentation classes statically; retain the loading state so deferred startup is honest. |
| Pin collection and Bitcoin copy | Existing route behavior modules contain broad document queries and global modal/map effects. | Include them in the root audit. Scope collection controls, cards, filters, and copy buttons to their route root. Preserve explicitly global modal, fullscreen, body, and history effects behind a documented allowlist. |

For all of these migrations:

- Keep feature folders and real integration seams.
- Delete route-level markers that carry no DOM ownership.
- Prefer `root.querySelector(...)` and `root.querySelectorAll(...)`.
- Use `root.matches(...)` when the behavior owns the element itself.
- Do not replace one global coordinator with another framework abstraction.

Add an architecture test for ordinary route behaviors that rejects
`document.querySelector`, `document.querySelectorAll`, and
`document.getElementById`, with a small explicit allowlist for shell/global
listeners, modal/body presentation, and shared integration internals that have
been proven to require global state.

### Phase 4: Remove personal-site framework abstractions

Delete `src/behaviors/shared/filterable-list.ts`. Replace it with one small
pure function shared by the two materially different features:

```ts
interface IndexedCard {
  element: HTMLElement
  search: string
  tags: ReadonlySet<string>
}

interface FilterState {
  query: string
  tags: ReadonlySet<string>
}

export function applyCardFilter(
  cards: readonly IndexedCard[],
  state: FilterState,
  match: 'all' | 'any' = 'all',
): number {
  const query = state.query.trim().toLowerCase()
  let visible = 0

  for (const card of cards) {
    const matchesQuery = !query || card.search.includes(query)
    const matchesTags = state.tags.size === 0 || (
      match === 'all'
        ? [...state.tags].every((tag) => card.tags.has(tag))
        : [...state.tags].some((tag) => card.tags.has(tag))
    )
    const show = matchesQuery && matchesTags
    card.element.hidden = !show
    if (show) visible += 1
  }

  return visible
}
```

Then let `project-filter.client.ts` and `recipe-filter.client.ts` explicitly
own their event bindings, URL format, accessible status, analytics, and button
state. Two clear feature controllers are preferable to a generalized DOM
engine with selectors, indexing policy, debounce policy, match modes, URL
policy, and callback hooks.

Remove `behavior()` from all site behavior entries and use `satisfies
ClientBehavior`. Move URL and button policy helpers into the site. Remove the
standalone recipe `copy-button` behavior if it remains recipe-only; retain it
only if a second independent consumer proves the element-level behavior is
valuable. Keep these genuine reusable seams:

- shared Leaflet adapters;
- shared PhotoSwipe/history lifecycle;
- pure gallery caption rendering;
- pure travel projection and label calculations;
- recipe quantity and conversion functions;
- narrow clipboard bindings that accept a supplied root and signal.

### Phase 5: Defer co-located module references

Do not make the current hashed co-located `Enhance` design primary. Until Nib
has a compile-time client-reference transform and an end-to-end package
consumer test:

- discover only `src/behaviors/**/*.client.*`;
- remove opaque path-hash IDs from the normal authoring path;
- do not stamp `__nibBehaviorId` onto every `.client.*` module under `src`;
- prevent supporting client modules from entering the behavior manifest;
- keep the explicit `src/behaviors/project-filter.client.ts` convention;
- consider `*.behavior.client.ts` later if a broader `.client.*` convention is
  needed.

`Enhance` is removed. New documentation, examples, tests, and consumer code
use `Behavior`.

### Phase 6: Documentation and release

Update all Nib documentation and examples that currently teach:

```tsx
<Behavior name="search" when="visible">
```

or exclusive behavior ownership. The canonical example must show a real
existing element and a plain typed client function:

```tsx
<Behavior name="recipe-filter">
  <section>...</section>
</Behavior>
```

Update at least:

- `docs/decisions/client-behaviors.md`;
- `docs/design/html-pages-layouts-and-islands.md`;
- docs-site React/island examples;
- README and package API exports;
- behavior typecheck fixtures and architecture tests;
- personal-site `docs/architecture-and-maintenance.md` if its guidance still
  describes empty markers, `when`, or exclusive behavior ownership.

Document the breaking API removal clearly. Do not publish `0.20.0` until the
package-consumer build proves that the published exports, behavior manifest,
runtime, and types agree.

## Verification gates

### Nib framework gates

1. Run the declared typecheck and unit suite.
2. Run focused SSR and ownership tests for the composition matrix.
3. Run runtime tests for immediate, idle, visible, remount, unmount, module
   load failure, and nested AbortSignal behavior. Parent and child signals
   must abort exactly once.
4. Run helper tests for queued-frame, timer, observer, and shared-script races.
5. Verify behavior discovery is limited to `src/behaviors` and that supporting
   `.client.*` modules do not become entries.
6. Verify immediate behavior modulepreloads and the absence of deferred
   preloads.
7. Build the docs/examples and inspect rendered behavior-only and static-only
   routes.
8. Run the packed package-consumer test against the built `0.20.0` package.
9. Run `git diff --check`.

### Personal-site gates

1. Run `bun run typecheck`.
2. Run `bun run test:unit`.
3. Run `bun run build`.
4. Run `bun run check:site`.
5. Run `bun run verify` from a clean, isolated build output directory.
6. Assert that every migrated route has a marker on its real root, no empty
   route marker remains, and no behavior emits `data-hydrate` or
   `<nib-behavior>` output. Island hydration markers remain governed by the
   island tests.
7. Assert that route behavior modules do not use unapproved document-wide
   selectors.
8. Exercise browser behavior on representative routes: shell controls,
   project filtering, recipe filtering and recipe detail controls, search
   empty-state synchronization, both galleries, article enhancements, and
   visible travel-map startup.
9. Exercise client navigation/remounting and confirm that old listeners,
   observers, timers, maps, lightboxes, and Pagefind instances are torn down.
10. Confirm static routes remain complete HTML and do not ship behavior or
    island runtime assets when no client feature is present.
11. Run `git diff --check` and record exact commits for both repositories.

Build success alone is not acceptance for the interactive migration. The
strongest evidence is rendered markup plus browser behavior after route
navigation and teardown.

## Non-goals

Do not move any of these into Nib core:

- filterable-list controllers;
- dropdown state;
- Pagefind integration;
- PhotoSwipe;
- Leaflet;
- Cooklang interactions or recipe conversion;
- analytics event policy;
- gallery view state;
- site URL parameter naming;
- newsletter/provider policy.

Do not rewrite the loader, route coordinator, or AbortSignal runtime wholesale.
Do not make client navigation mandatory. Do not add a generic integration
framework or a generic lifecycle superclass. Do not claim a release, push, or
production readiness from local tests alone.

## Implementation result

The plan is implemented in `/Volumes/Storage/code/nib` and the actual sibling
consumer `/Volumes/Storage/code/personal-site-nib` (the requested
`../nib-personal-site` path does not exist in this workspace).

Completed framework work includes the wrapper-free root-scoped `Behavior` API,
`defer="idle|visible"`, legal independent behavior nesting with island overlap
protection, canonical `data-nib-behavior` markers, route-specific immediate
behavior preloads, signal-based client bootstraps, narrowed behavior discovery,
the lifecycle helper race fixes, and the `@briansunter/nib/client/lifecycle`
entry point. The `Enhance`, `LazyBehavior`, `when`, `props`, `behavior()`, old
behavior types, and legacy behavior marker protocol have now been removed.

Completed consumer work includes honest roots for shell, filters, search,
galleries, content enhancements, recipe detail, pin collection, Bitcoin copy,
and travel map; root-scoped client modules; recipe-only copy attachment in the
recipe detail controller; deletion of the generalized filter controller and
standalone recipe/copy behavior entries; and Pagefind clear-state
synchronization at the app integration boundary.

Verification completed:

- Nib `bun run verify`: 44 framework test files/310 tests plus the separate
  2-test package-consumer invocation; `bun run check:unused` and
  `bun run build:framework` also passed.
- Personal site `bun run verify`: typecheck, 23 files/112 tests, production
  build, and `nib check` passed (`671` routes and `24644` local references).
- Generated HTML contains canonical behavior roots and no emitted
  `<nib-behavior>` or behavior `data-hydrate` protocol.
- Preview smoke checks passed for shell controls, project and recipe filtering,
  recipe detail scaling, both galleries, article copy behavior, search clear
  synchronization, deferred travel-map startup, client navigation remounting,
  and clean browser runtime logs.

The consumer manifest requests `@briansunter/nib: ^0.20.0`. Its lockfile still
records the published `0.19.0` package because `0.20.0` is not published in the
registry yet; local verification uses the existing symlink to this Nib
checkout. Build Nib before running the consumer verification: concurrent
rebuilds can temporarily remove the symlinked checkout's generated declaration
files while the framework build is emitting them. Regenerate that lockfile as
part of the approved package release.

## Definition of done

This plan is complete only when:

- one wrapper-free `Behavior` API is the documented normal path;
- behavior modules are plain typed functions receiving `{ root, signal }`;
- behavior nesting is legal while island overlap remains rejected;
- immediate and explicitly deferred startup have distinct, tested semantics;
- lifecycle helper races and shared-resource ownership are correct;
- the personal site has honest roots and no empty feature markers;
- route behavior selectors are root-scoped;
- the generalized filter controller and unnecessary client utility policy are
  deleted from the site/framework boundary;
- co-located hashed behavior discovery is postponed or removed from the primary
  path;
- plugin bootstraps use AbortSignal lifecycle language;
- documentation, examples, types, manifests, and package-consumer output agree;
- both repository verification suites and representative browser checks pass;
- only then is the work eligible for an explicitly approved Nib `0.20.0`
  release.
