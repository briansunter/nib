# ADR: direct client enhancements

Status: accepted

Last reviewed: 2026-08-11

Nib supports non-React progressive enhancement through the server-safe
`enhance('...')` helper. It returns attributes that an application spreads
onto one existing intrinsic HTML element. The enhancement ID maps directly to
one browser module below `src/enhancements` without importing that
implementation into the server graph.

The module default-exports a plain typed mount function satisfying
`ClientEnhancement`. Modules use
`src/enhancements/<id>/index.client.ts` or `.js`; JavaScript needs no helper.
This leaves one declaration at the JSX call site and one implementation file;
applications do not maintain a parallel registry or forwarding adapter.

Enhancements start immediately by default. Expensive features may use
`enhance('feature', { when: 'visible' })` to wait until the marked root
approaches the viewport. There is no `idle` strategy. The browser
implementation receives positional `root` and `signal` arguments. Cleanup is
driven by aborting the signal before a root is detached.

Nib's helper produces `data-nib-enhancement` and optional `data-nib-when`
attributes. Final rendered HTML is the source of truth, and Nib validates the
same marker contract in helper-authored and raw HTML. Because the attributes
are spread onto an existing element, Nib emits no wrapper or framework-owned
layout styling.

Pages without enhancements omit the enhancement entry. Projects without
enhancement modules build no enhancement runtime. That runtime is DOM-only and
ships no browser React. Essential content must remain in the server-rendered
HTML.

Enhancements may nest when their markers land on different existing elements,
and cleanup aborts the deepest roots first. Multiple enhancements on the exact
same element remain invalid.

CSS imported by an enhancement is linked only on routes that render that
enhancement, including visible roots. Immediate JavaScript may be preloaded,
while visible enhancement chunks stay deferred.

Stateful React UI is a separate opt-in contract. A module below `src/islands`
default-exports `island(Component)` or
`island(Component, { when: 'visible' })` from `@briansunter/nib/react`; `load`
is the default and there is no `idle` strategy. Its ID is derived from the
module path and its props must be JSON-serializable. Only routes that render an
island ship the island runtime and client React. Island boundaries belong in
normal flow content; Nib rejects contexts where the HTML parser would move or
rewrite the boundary, such as a direct child of a table section or select.
