# ADR: direct client behaviors

Status: accepted

Last reviewed: 2026-07-29

Nib will support non-React progressive enhancement through an explicit,
server-safe `<Behavior name="...">` boundary. The name maps directly to one
browser module below `src/behaviors` and carries optional JSON-serializable
props without importing that implementation into the server graph.

The module default-exports a plain mount function. The optional `behavior(...)`
helper provides contextual TypeScript types without changing the runtime value.
JavaScript needs no helper. This leaves one declaration at the JSX call site
and one implementation file; applications do not maintain a parallel registry
or adapter whose only job is to forward to another initializer.

Behavior roots use `when="load"`, `when="idle"`, or `when="visible"`, matching
the island scheduling vocabulary without calling imperative mounting
"hydration." The browser implementation receives only its root, validated
props, and an `AbortSignal`. Cleanup is driven by aborting the signal before a
root is detached.

Nib emits the behavior boundary with framework-owned `display: contents`
styling. Layout and semantics therefore belong to its server-rendered children,
not the implementation marker.

Pages without an island or behavior remain runtime-free. Behavior-only pages do
not import or ship `react-dom/client`. Essential content must remain in the
server-rendered HTML.

One DOM subtree has one client owner. Behaviors and islands may be siblings on
the same page, and React islands may compose other island definitions into the
same React root. Nib rejects behavior-in-behavior, behavior-in-island, and
island-in-behavior nesting during server rendering with an ownership error.
Authors must use sibling boundaries or let one client module own the complete
subtree.
