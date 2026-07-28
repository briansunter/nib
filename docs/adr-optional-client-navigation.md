# ADR: opt-in static client navigation

Status: accepted — approved for implementation on 2026-07-27

## Context

Nib deliberately omits client-side routing. Its static pages, ordinary links,
and hard-navigation behavior are complete without JavaScript. The personal-site
replica nevertheless contains a proven document-navigation layer that currently
lives in application code. It coordinates fetched HTML, history, scroll and
focus, view transitions, persistent DOM, head and script synchronization,
prefetching, and the public island/behavior runtime coordinator.

Keeping that implementation application-owned duplicates framework lifecycle
logic and leaves the replica coupled to Astro event and attribute names. Making
navigation a default would violate Nib's static-first contract and add browser
runtime to sites that did not request it.

## Proposed decision

Accept client navigation only as an explicitly configured first-party plugin.
The ordinary Nib build and root package entry remain navigation-free.

```ts
// nib.config.ts
import { defineConfig } from '@briansunter/nib'
import { clientNavigation } from '@briansunter/nib/navigation'

export default defineConfig({
  plugins: [clientNavigation()],
})
```

`@briansunter/nib/navigation` is server-safe plugin configuration. Browser
implementation and controller types live at
`@briansunter/nib/client/navigation`; the server plugin must not import that
module. The generated client entry uses static imports and includes the
navigation controller only when the plugin contributes it.

The plugin is site-wide because document navigation owns history and the
current document, not an individual page subtree. It uses the public client
runtime coordinator to unmount islands and behaviors before replacing
`#root`, then mounts the new document after the swap.

## Public browser contract

The controller is lifecycle-owned and has no private `window` singleton:

```ts
interface ClientNavigationController {
  mount(): void
  navigate(to: string | URL, options?: NavigateOptions): Promise<void>
  destroy(): void
}
```

Repeated `mount()` calls are idempotent. `destroy()` aborts active fetches,
prefetches, observers, timers, listeners, and view transitions. A later
controller can mount cleanly.

The initial contract uses Nib-owned names:

- `nib:navigation-before-swap`
- `nib:navigation-after-swap`
- `nib:navigation-load`
- `data-nib-navigation-reload`
- `data-nib-navigation-history="replace"`
- `data-nib-navigation-persist`
- `data-nib-prefetch="hover|tap|load|viewport|false"`
- `data-nib-script-rerun`

Lifecycle events are typed `CustomEvent` values. Before-swap detail includes
the source and destination URLs, navigation direction and type, parsed next
document, abort signal, source element, and a replaceable `swap()` operation.
The default swap remains framework-owned. Event names do not emulate Astro.

## Navigation and fallback rules

The controller intercepts only unmodified, same-origin HTTP(S) navigation to
the current browsing context. Downloads, external URLs, non-`_self` targets,
explicit reload markers, unsupported schemes, and non-GET forms retain native
browser behavior.

A navigation:

1. snapshots the current history index and scroll position;
2. aborts any superseded navigation;
3. fetches same-origin HTML with same-origin credentials;
4. follows redirects and validates the final URL and HTML media type;
5. parses the complete document;
6. preloads new styles before removing old ones;
7. unmounts client runtimes before detaching `#root`;
8. synchronizes document/head/body attributes, head nodes, scripts, and
   explicitly persisted elements;
9. commits push, replace, or traversal history exactly once;
10. restores focus and selection for persisted controls;
11. restores traversal scroll, scrolls to a hash target, or starts at the top;
12. mounts client runtimes and announces the new route.

If fetching, parsing, style loading, root validation, swapping, or script
execution cannot safely complete, the controller performs a hard navigation to
the destination. Aborted superseded navigation does not hard-navigate.
Disabling the plugin leaves ordinary links, forms, and browser history intact.

## Prefetch and cache policy

Prefetch is same-origin, GET-only, bounded, and disabled when the browser
reports data saving, a slow connection, or offline state. Hover prefetch has a
short intent delay. Tap, load, and viewport strategies require the explicit
attribute above. Cache entries have a short TTL and a fixed maximum count;
failed or non-HTML responses are evicted. Prefetch never mutates history or the
live document.

`clientNavigation({ prefetch: 'explicit' })` disables the implicit hover
strategy while retaining annotated `hover`, `tap`, `load`, and `viewport`
strategies. The default remains `hover` for compatibility.

## Head, style, script, and persistence policy

Head synchronization compares resolved URLs rather than authored relative
strings. Existing styles, font preloads, inline styles, and scripts are reused
when semantically identical. New styles are preloaded before the swap.

Executable scripts already present in the current document do not rerun.
New executable scripts run in document order after the swap; an explicit rerun
attribute opts an existing script into another execution. Non-executable script
types remain inert. Script handling must preserve CSP-relevant attributes and
must not synthesize code absent from the fetched same-origin document.

Persisted elements require a non-empty stable key and matching element name.
Only outermost persisted roots move into the next document. If focus is inside
a persisted input or textarea, focus and its selection range are restored.
Duplicate persistence keys are a deterministic navigation error and fall back
to a hard navigation.

## Accessibility and history

The controller preserves native fallback, modified-click behavior, hash
navigation, back/forward direction, scroll restoration, and focus. After a
successful route swap it creates one live-region announcement from the title,
`h1`, or pathname. Hash targets receive focus only when normally focusable.
View transitions are optional enhancement; unsupported or failed transitions
use the same swap and lifecycle path.

Application `replaceState` calls may preserve their own fields. Nib owns only
namespaced navigation index and scroll keys and repairs those keys when taking
a snapshot.

## Consequences

- Static navigation remains the default and requires no client runtime.
- A site that opts in ships one site-wide navigation controller.
- Server and client imports remain explicit; no dynamic import is required for
  the controller.
- The replica can delete its application navigation controller and Astro
  lifecycle compatibility after migration.
- Runtime consumers must use the typed Nib lifecycle rather than private
  globals or framework-emulation event names.
- This decision does not add runtime routes, server rendering, data loaders,
  or JavaScript-required content.

## Required validation before acceptance

- abort races and rapid consecutive navigation;
- same-origin and cross-origin redirects;
- base paths, trailing slashes, query strings, and hashes;
- head/style/script ordering, CSP attributes, and rerun policy;
- static → island/behavior → static transitions with exact cleanup;
- duplicate persistence keys and focus/selection restoration;
- push, replace, back, and forward scroll restoration;
- native fallback for opt-out links, downloads, targets, forms, non-HTML
  responses, missing roots, fetch errors, and disabled plugin;
- prefetch TTL, eviction, connection policy, and observer cleanup;
- view-transition success, rejection, abort, and unsupported fallback;
- no listener, observer, React root, behavior, cache, or timer accumulation;
- full replica interaction and 493-page parity verification after adoption.

Approval changes only this ADR's status from `proposed` to `accepted`.
Implementation and replica adoption remain separate commits.
