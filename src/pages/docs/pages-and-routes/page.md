---
title: Pages and routes
description: Map files under src/pages to static routes.
layout: docs
---

# Pages and routes

Routes are discovered from folders under `src/pages`. Each route folder contains one page module.

| Source file | Route |
| --- | --- |
| `src/pages/page.tsx` | `/` |
| `src/pages/about/page.tsx` | `/about/` |
| `src/pages/docs/page.md` | `/docs/` |
| `src/pages/404/page.tsx` | `/404.html` fallback |

## React pages

React pages export a default component and can export metadata:

```tsx
import type { PageMeta } from '../../framework/types'

export const meta: PageMeta = {
  title: 'About',
  description: 'About this site.'
}

export default function Page() {
  return <h1>About</h1>
}
```

Pages are rendered on the server during the build and hydrated in the browser. React state and event handlers work after hydration.

## Navigation

Edit `src/site.config.ts` to add links to the main navigation. Internal links go through the base-path helper so they work on both `/` and GitHub project pages.
