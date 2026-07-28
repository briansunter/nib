---
title: Client navigation
description: Optionally enhance ordinary static links with safe document swaps.
layout: docs
---

# Client navigation

Nib pages use ordinary browser navigation by default. Enable the optional
plugin when a site benefits from preserved shell state, prefetching, scroll
restoration, and View Transitions:

```ts
// nib.config.ts
import { defineConfig } from '@briansunter/nib'
import { clientNavigation } from '@briansunter/nib/navigation'

export default defineConfig({
  site: { title: 'My site' },
  plugins: [clientNavigation()],
})
```

The plugin adds one site-wide browser entry. It is absent from an unconfigured
site, uses static imports, and does not depend on React DOM. Every destination
is still a complete prerendered document, so links work when JavaScript is
disabled or an enhanced navigation falls back.

Nib owns the returned navigation controller through the client-entry cleanup
contract, so a development HMR replacement destroys listeners, observers,
pending fetches, and transitions before starting the replacement.

## Eligible navigation

Nib intercepts unmodified, same-origin HTTP(S) links in the current browsing
context and same-origin GET forms. Downloads, external URLs, other targets,
non-GET forms, and elements with `data-nib-navigation-reload` stay native.
Fetch errors, non-HTML responses, missing roots, invalid persistence, style or
script failures, and unsafe redirects hard-navigate to the destination.

```tsx
<a href="/account" data-nib-navigation-reload>Reload account</a>
<a href="/archive" data-nib-navigation-history="replace">Replace history</a>
```

## Prefetching

Eligible links use delayed hover intent by default. Override it per link:

```tsx
<a href="/next" data-nib-prefetch="tap">Next</a>
<a href="/popular" data-nib-prefetch="viewport">Popular</a>
<a href="/private" data-nib-prefetch="false">Private</a>
```

The supported values are `hover`, `tap`, `load`, `viewport`, and `false`.
Prefetching is same-origin, GET-only, short-lived, and bounded. It is disabled
when the browser is offline, saving data, or reports a slow connection.

## Persistence and lifecycle

Give an element a non-empty stable key to move that exact node into the next
document. Matching element names are required; duplicate keys fail safely.
Focused inputs and text selections are restored.

```tsx
<input data-nib-navigation-persist="site-search" />
```

Browser integrations can use the public controller and typed custom events:

```ts
import {
  createClientNavigation,
  type NavigationBeforeSwapDetail,
} from '@briansunter/nib/client/navigation'

document.addEventListener('nib:navigation-before-swap', (event) => {
  const detail: NavigationBeforeSwapDetail = event.detail
  console.debug(detail.from.href, detail.to.href)
})

const navigation = createClientNavigation()
navigation.mount()
await navigation.navigate('/next')
navigation.destroy()
```

`nib:navigation-before-swap` exposes the parsed destination, abort signal, and
a replaceable `swap()` operation. `nib:navigation-after-swap` fires after DOM,
history, focus, and scroll commit. `nib:navigation-load` fires after new scripts
and Nib client runtimes mount.
