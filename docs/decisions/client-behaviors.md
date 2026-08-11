# ADR: direct client behaviors

Status: accepted

Last reviewed: 2026-08-11

Nib will support non-React progressive enhancement through an explicit,
server-safe `<Behavior name="...">` boundary. The name maps directly to one
browser module below `src/behaviors` without importing that implementation into
the server graph.

The module default-exports a plain typed mount function satisfying
`ClientBehavior`. Modules use the folder convention
`src/behaviors/<id>/index.client.ts`; JavaScript needs no helper. This leaves one declaration at the
JSX call site and one implementation file; applications do not maintain a
parallel registry or adapter whose only job is to forward to another
initializer.

Behavior roots start immediately by default. Expensive features opt into
`defer="idle"` or `defer="visible"`; imperative mounting is not called
"hydration." The browser implementation receives positional `root` and
`AbortSignal` arguments.
Cleanup is driven by aborting the signal before a root is detached.

Nib places `data-nib-behavior` directly on the one existing element supplied as
the behavior child. It emits no wrapper or framework-owned layout styling.

Pages without behaviors omit the behavior entry. Projects without behavior
modules build no behavior runtime and ship no browser React. Essential content
must remain in the server-rendered HTML.

Behaviors may nest when their markers land on different existing elements, and
cleanup aborts the deepest roots first. Multiple behaviors on the exact same
element remain invalid. Nib owns both marker attributes and rejects children
that predefine either one.

CSS imported by a behavior is linked only on routes that render that behavior,
including deferred roots. Immediate JavaScript may be preloaded, while idle and
visible behavior chunks stay deferred.
