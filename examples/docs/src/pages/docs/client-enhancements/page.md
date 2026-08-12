---
title: Client enhancements
description: Add scoped DOM behavior or an opt-in React island to static HTML.
layout: docs
---

# Client enhancements

Pages, layouts, and ordinary React components render complete static HTML.
Choose the smallest browser boundary that fits the interaction:

- use `enhance()` for event listeners, DOM state, or an imperative browser
  library layered onto existing HTML;
- use a React island for a local interface that needs React state, effects, or
  hooks.

Neither choice turns the page into a client-rendered application.

## Enhance an existing element

Spread `enhance()` directly onto the HTML element that owns the interaction:

```tsx
import { enhance } from '@briansunter/nib'

export function Counter() {
  return (
    <button {...enhance('counter')} data-count="0" type="button">
      Count: 0
    </button>
  )
}
```

Add the matching module at the folder path below `src/enhancements`:

```ts
// src/enhancements/counter/index.client.ts
import type { ClientEnhancement } from '@briansunter/nib'

export default ((root, signal) => {
  let count = Number(root.dataset.count ?? 0)
  root.addEventListener('click', () => {
    count += 1
    root.textContent = `Count: ${count}`
  }, { signal })
}) satisfies ClientEnhancement
```

The module receives the marked `root` and its cleanup `signal` as positional
arguments. Scope queries to `root` and pass `{ signal }` to event listeners.
Nib aborts the signal before development replacement or runtime teardown.

The name is the folder path below `src/enhancements`; nested IDs such as
`gallery/filters` map to
`src/enhancements/gallery/filters/index.client.ts`. Plain `.js` entry modules
are also supported and can default-export the function without a type helper.

Enhancements start immediately by default. Use the single optional timing when
work should wait until the marked root approaches the viewport:

```tsx
<section {...enhance('map', { when: 'visible' })} aria-label="Map">
  Complete static fallback
</section>
```

There is no `idle` timing. `enhance()` returns the canonical
`data-nib-enhancement` and optional `data-nib-when` markers. The final rendered
HTML is the source of truth, so Nib validates the same marker contract in raw
HTML too. Enhancements may nest when each owns a distinct element, and cleanup
runs deepest first.

CSS imported by an enhancement module is linked only on routes that render the
enhancement, including visible roots. Routes without enhancement markers omit
the enhancement runtime. The runtime is DOM-only and contains no React.

## React islands

Use an island when a local interactive component is naturally expressed with
React. Island modules live below `src/islands`, import the helper from the
dedicated React entry, and default-export the definition:

```tsx
// src/islands/counter.tsx
import { useState } from 'react'
import { island } from '@briansunter/nib/react'
import './counter.css'

function Counter({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      Count: {count}
    </button>
  )
}

export default island(Counter, { when: 'visible' })
```

Import the default export into a page or layout like an ordinary component:

```tsx
// src/pages/page.tsx
import Counter from '../islands/counter'

export default function HomePage() {
  return <Counter initialCount={0} />
}
```

Nib derives the island ID from its module path, so
`src/islands/cart/summary.tsx` becomes `cart/summary`; there is no registry or
manually assigned ID. It server-renders complete initial HTML and serializes
the props needed to hydrate that root.

Island props must be JSON-serializable: strings, finite numbers, booleans,
`null`, arrays, and plain objects composed from those values. Functions, React
elements, dates, class instances, sparse arrays, cycles, and other non-JSON
values are rejected.

Nib owns the generated `<nib-island>` boundary and its `data-nib-*` hydration
metadata; application code renders the island definition instead of mutating
that runtime metadata.

Place an island where a custom element is valid flow content. An island cannot
sit directly inside restricted parser contexts such as `table`, `tbody`, `tr`,
or `select`; make the containing table or control subtree the island instead.
Nib fails the build when the browser would restructure the boundary before
hydration.

`island(Component)` hydrates on `load` by default. Fix the policy for every
instance with `island(Component, { when: 'load' })` or
`island(Component, { when: 'visible' })`. There is no `idle` strategy. Nested
island definitions compose inside their owning React root.

Island CSS and JavaScript are route-scoped. Routes without islands omit the
island runtime and browser React, so an enhancement-only site still has a zero
React client.

## Application-wide setup and navigation

Use the optional exact entry `src/client.ts` only when browser setup has no
scoped enhancement or island owner. Nib invokes its default export with one
cleanup signal:

```ts
import type { ClientInitializer } from '@briansunter/nib'

export default ((signal) => {
  const reportOnline = () => {
    document.documentElement.toggleAttribute('data-online', navigator.onLine)
  }
  reportOnline()
  window.addEventListener('online', reportOnline, { signal })
  window.addEventListener('offline', reportOnline, { signal })
}) satisfies ClientInitializer
```

The initializer may return a promise. CSS imported from `src/client.ts` is
application-wide. Projects without this file do not build or link that entry.

Nib does not intercept links or forms. Navigation loads each prerendered
document through the browser's native behavior; there is no client router,
document swapping, prefetch controller, or navigation history API.
