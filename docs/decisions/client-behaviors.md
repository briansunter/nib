# ADR: direct client behaviors

Status: accepted

Last reviewed: 2026-07-29

Nib will support non-React progressive enhancement through an explicit,
server-safe `<Behavior name="...">` boundary. The name maps directly to one
browser module below `src/behaviors` without importing that implementation into
the server graph.

The module default-exports a plain typed mount function satisfying
`ClientBehavior`. JavaScript needs no helper. This leaves one declaration at the
JSX call site and one implementation file; applications do not maintain a
parallel registry or adapter whose only job is to forward to another
initializer.

Behavior roots start immediately by default. Expensive features opt into
`defer="idle"` or `defer="visible"`; imperative mounting is not called
"hydration." The browser implementation receives its root and an `AbortSignal`.
Cleanup is driven by aborting the signal before a root is detached.

Nib places `data-nib-behavior` directly on the one existing element supplied as
the behavior child. It emits no wrapper or framework-owned layout styling.

Pages without an island or behavior remain runtime-free. Behavior-only pages do
not import or ship `react-dom/client`. Essential content must remain in the
server-rendered HTML.

Behaviors may nest when their markers land on different existing elements.
Nib rejects behavior-in-island and island-in-behavior nesting during server
rendering with an ownership error. Multiple behaviors on the exact same element
remain invalid.
