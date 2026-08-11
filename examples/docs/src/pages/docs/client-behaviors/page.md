---
title: Client behaviors
description: Enhance one server-rendered element with scoped browser code.
layout: docs
---

# Client behaviors

Pages, layouts, and ordinary React components render complete static HTML.
When one element needs browser interaction, mark that existing element with
`Behavior` and provide one matching client module.

```tsx
import { Behavior } from '@briansunter/nib'

export function Counter() {
  return (
    <Behavior name="counter">
      <button data-count="0" type="button">Count: 0</button>
    </Behavior>
  )
}
```

```ts
// src/behaviors/counter/index.client.ts
import type { ClientBehavior } from '@briansunter/nib'

export default ((root, signal) => {
  let count = Number(root.dataset.count ?? 0)
  root.addEventListener('click', () => {
    count += 1
    root.textContent = `Count: ${count}`
  }, { signal })
}) satisfies ClientBehavior
```

The name is the folder path below `src/behaviors`; nested IDs such as
`gallery/filters` map to `src/behaviors/gallery/filters/index.client.ts`.
The default export receives the marked `HTMLElement` and an `AbortSignal`.
Listeners registered with `{ signal }` are removed automatically before a
client-navigation document swap or development reload.

## Deferring startup

Behavior startup is immediate by default. Use `defer="idle"` for non-urgent
work or `defer="visible"` to wait until the marked root approaches the
viewport:

```tsx
<Behavior name="map" defer="visible">
  <section aria-label="Map">Complete static fallback</section>
</Behavior>
```

Visible deferral observes that root element only. A deferred behavior's
stylesheet is still linked on every route that renders it, while its JavaScript
is loaded only when the strategy runs.

## Ownership rules

`Behavior` accepts exactly one intrinsic DOM element. It adds
`data-nib-behavior` and optional `data-nib-defer`; do not author those framework
attributes yourself. Behaviors may nest when each owns a distinct element.
Cleanup runs deepest first, so a child releases its resources before its
parent.

Routes without behaviors omit the behavior entry. Projects with no behavior
modules and no configured client integration produce no framework JavaScript.
