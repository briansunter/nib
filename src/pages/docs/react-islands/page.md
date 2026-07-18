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
import { defineIsland } from '../framework/islands'

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

## Props and boundaries

Island props must be JSON-serializable. Strings, booleans, finite numbers, `null`, arrays, plain objects, and absent optional properties are supported. Functions, React nodes, class instances, dates, maps, sets, cycles, explicit `undefined`, and non-finite numbers fail type checking or the build.

An island owns its own state and context tree. Keep the boundary as small as practical, but if two controls share React context or coordinate frequently, make them one larger island with ordinary child components. Islands cannot be nested.

The component must produce the same initial markup on the server and in the browser. Read from `window`, storage, media queries, or other browser-only APIs in an event handler or `useEffect`, not while rendering. This preserves the static fallback and avoids hydration mismatches.

Read the repository's [`docs/architecture.md`](https://github.com/briansunter/nib/blob/master/docs/architecture.md) for the rendering pipeline and design constraints. The separate [HTML pages proposal](https://github.com/briansunter/nib/blob/master/docs/html-pages-layouts-and-islands.md) explores typed island bindings for a future `page.html` route format; it is not part of the current API.
