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
import { island } from '@briansunter/nib'

function Counter({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  return <button onClick={() => setCount((value) => value + 1)}>Count: {count}</button>
}

export default island(Counter)
```

Nib derives the ID from the module path below `src/islands`. For example,
`src/islands/cart/summary.tsx` uses `cart/summary`.

Import the definition from a TSX page or layout:

```tsx
// src/pages/example/page.tsx
import Counter from '../../islands/counter'

export default function Page() {
  return <Counter initialCount={0} when="load" />
}
```

## Activation timing

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
// src/pages/example/page.tsx
import { Behavior } from '@briansunter/nib'

export default function Page() {
  return (
    <Behavior name="reveal" props={{ open: false }}>
      <button type="button">Toggle details</button>
      <p data-panel hidden>Complete static details.</p>
    </Behavior>
  )
}
```

```ts
// src/behaviors/reveal.client.ts
import { behavior } from '@briansunter/nib/client'

export default behavior<{ open: boolean }>(({ root, props, signal }) => {
  const button = root.querySelector('button')
  const panel = root.querySelector<HTMLElement>('[data-panel]')
  if (panel) panel.hidden = !props.open
  button?.addEventListener('click', () => {
    if (panel) panel.hidden = !panel.hidden
  }, { signal })
})
```

The behavior name matches its `.client.ts` or `.client.js` path under
`src/behaviors`. Plain JavaScript may default-export the mount function without
`behavior(...)`.
Behavior-only pages ship the behavior runtime, not React DOM. Use
`when="idle"` or `when="visible"` on `<Behavior>` to defer non-critical work;
the default is `load`.

## Client ownership

Behaviors and islands can be siblings on the same page. Do not nest one inside
the other or nest behaviors: one DOM subtree must have one browser owner. Nib
reports this as a server-render/build error and tells you to use sibling
boundaries or give one client module the entire subtree. React islands may
still compose other island definitions; Nib renders those inside the same
outer React root.

## Props and boundaries

Island props must be JSON-serializable. Strings, booleans, finite numbers, `null`, arrays, plain objects, and absent optional properties are supported. Functions, React nodes, class instances, dates, maps, sets, cycles, explicit `undefined`, and non-finite numbers fail type checking or the build.

A top-level island owns its own state and context tree. An island may render
another island definition; Nib composes the child into the same React root, and
the outermost island's `when` strategy controls the whole subtree. This lets
interactive pieces share state and context through ordinary React composition
without creating conflicting nested hydration roots.

The component must produce the same initial markup on the server and in the browser. Read from `window`, storage, media queries, or other browser-only APIs in an event handler or `useEffect`, not while rendering. This preserves the static fallback and avoids hydration mismatches.

Read the repository's [architecture reference](https://github.com/briansunter/nib/blob/master/docs/reference/architecture.md) for the rendering pipeline and design constraints. The separate [HTML pages proposal](https://github.com/briansunter/nib/blob/master/docs/design/html-pages-layouts-and-islands.md) explores typed island bindings for a future `page.html` route format; it is not part of the current API.
