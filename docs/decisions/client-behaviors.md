# ADR: typed client behaviors

Status: accepted

Last reviewed: 2026-07-28

Nib will support non-React progressive enhancement through an explicit,
server-safe behavior descriptor. A descriptor identifies a browser
implementation and JSON-serializable props without importing that
implementation into the server graph.

Behavior roots use the same `load`, `idle`, and `visible` scheduling vocabulary
as React islands. The browser implementation receives only its root,
validated props, and an `AbortSignal`. Cleanup is driven by aborting the signal
before a root is detached.

Nib emits the behavior boundary with framework-owned `display: contents`
styling. Layout and semantics therefore belong to its server-rendered children,
not the implementation marker.

Pages without an island or behavior remain runtime-free. Behavior-only pages do
not import or ship `react-dom/client`. Essential content must remain in the
server-rendered HTML.
