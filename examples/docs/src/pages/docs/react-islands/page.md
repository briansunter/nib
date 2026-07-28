---
title: React islands
description: Add type-safe interactive React components to otherwise static pages.
layout: docs
---

# React islands

TSX pages, Markdown layouts, and ordinary components produce static HTML. Put only a browser-interactive subtree under `src/islands`, then use it like a normal typed React component.

```tsx
// src/islands/counter.tsx
import { useState } from 'react'
import { defineIsland } from '@briansunter/nib'

function Counter({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  return <button onClick={() => setCount((value) => value + 1)}>Count: {count}</button>
}

export default defineIsland('counter', Counter)
```

The ID must match the module path below `src/islands`. For example, `src/islands/cart/summary.tsx` uses `cart/summary`.

Import the definition from a TSX page or layout:

```tsx
// src/pages/example/page.tsx
import Counter from '../../islands/counter'

export default function Page() {
  return <Counter initialCount={0} hydrate="load" />
}
```

## Hydration timing

| Value | Behavior |
| --- | --- |
| `load` | Hydrates immediately and is the default. |
| `idle` | Waits for idle time, with a timer fallback. |
| `visible` | Waits until an island child approaches the viewport; text-only roots use their parent as the observation target. |

Every island is rendered into the generated HTML first. The browser then loads that island module and hydrates its independent React root. A route without islands has no React client entry.

## Client behaviors without React

Use a behavior when the HTML already exists and the browser only needs event
listeners or another imperative enhancement:

```tsx
// src/components/reveal.tsx
import { defineClientBehavior } from '@briansunter/nib'

export const Reveal = defineClientBehavior<{ open: boolean }>('reveal')
```

```ts
// src/behaviors/reveal.client.ts
import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'

export default defineBehaviorClient(({ root, signal }) => {
  const button = root.querySelector('button')
  const panel = root.querySelector<HTMLElement>('[data-panel]')
  button?.addEventListener('click', () => {
    if (panel) panel.hidden = !panel.hidden
  }, { signal })
})
```

Render `<Reveal props={{ open: false }}>...</Reveal>` around the complete static
fallback. Behavior IDs match their `.client.ts` path under `src/behaviors`.
Behavior-only pages ship the behavior runtime, not React DOM. Both runtime
types support cancellable `load`, `idle`, and `visible` scheduling.

## Props and boundaries

Island props must be JSON-serializable. Strings, booleans, finite numbers, `null`, arrays, plain objects, and absent optional properties are supported. Functions, React nodes, class instances, dates, maps, sets, cycles, explicit `undefined`, and non-finite numbers fail type checking or the build.

A top-level island owns its own state and context tree. An island may render another island definition; Nib composes the child into the same React root, and the outermost island's `hydrate` strategy controls the whole subtree. This lets interactive pieces share state and context through ordinary React composition without creating conflicting nested hydration roots.

The component must produce the same initial markup on the server and in the browser. Read from `window`, storage, media queries, or other browser-only APIs in an event handler or `useEffect`, not while rendering. This preserves the static fallback and avoids hydration mismatches.

Read the repository's [`docs/architecture.md`](https://github.com/briansunter/nib/blob/master/docs/architecture.md) for the rendering pipeline and design constraints. The separate [HTML pages proposal](https://github.com/briansunter/nib/blob/master/docs/html-pages-layouts-and-islands.md) explores typed island bindings for a future `page.html` route format; it is not part of the current API.
