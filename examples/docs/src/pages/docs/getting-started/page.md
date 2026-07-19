---
title: Getting started
description: Install Nib, run the example site, and add your first page.
layout: docs
---

# Getting started

## 1. Scaffold a site

Run Nib’s scaffolding command with npm, Bun, pnpm, or another package runner:

```bash
npx @briansunter/nib init my-site
cd my-site
npm run dev
```

The command creates only your site configuration and source files, installs dependencies, and leaves Nib as a versioned dependency. Framework routing, Vite integration, development SSR, prerendering, document generation, and island hydration stay inside `@briansunter/nib`.

## 2. Set the site identity

Edit `nib.config.ts`:

```ts
import { defineConfig } from '@briansunter/nib'

export default defineConfig({
  site: {
    title: 'My Site',
    description: 'A short description of my site.',
    titleTemplate: '%s | My Site',
    navigation: [
      { label: 'Home', href: '/' },
      { label: 'Hello', href: '/hello/' },
    ],
  },
})
```

The site config supplies default metadata and header navigation.

## 3. Add an optional Vite adapter

Nib owns Vite’s entries, SSR, base path, and output settings. Add project-owned
Vite plugins through the narrow `vite` factory; it creates a fresh adapter for
each development, client, and server graph. The starter uses this for Tailwind:

```ts
import { defineConfig } from '@briansunter/nib'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: { title: 'My Site' },
  vite: () => tailwindcss(),
})
```

Use `plugins` only for packages that also need Nib build or rendering lifecycle
hooks, such as the image optimizer.

## 4. Add a TSX page

Create `src/pages/hello/page.tsx`:

```tsx
export default function HelloPage() {
  return <h1>Hello from Nib</h1>
}
```

Visit <http://localhost:5173/hello/>. The folder name becomes the URL, and the file must be named `page.tsx`.

## 5. Add a Markdown page

Create `src/pages/notes/page.md`:

```md
---
title: Notes
description: A page written in Markdown.
layout: docs
---

# Notes

Write your content here.
```

Visit <http://localhost:5173/notes/>. Use Markdown for content-heavy pages and a TSX page for custom static structure.

## 6. Add interaction when needed

Nib includes a counter island at `src/islands/counter.tsx`. Import it into the TSX page:

```tsx
import Counter from '../../islands/counter'

export default function HelloPage() {
  return (
    <>
      <h1>Hello from Nib</h1>
      <Counter initialCount={0} hydrate="load" />
    </>
  )
}
```

The rest of the page stays static HTML. Follow the [React islands guide](../react-islands/) to define your own typed island and choose when it hydrates.

## 7. Check a production build

```bash
bun run typecheck
bun run build
bun run preview
```

The build writes the deployable site to `dist/client`. `dist/server` is only an intermediate prerendering bundle. Preview the generated site at the URL printed by Vite.

## Useful next steps

- Read [Pages and routes](../pages-and-routes/) for metadata, drafts, and fallback behavior.
- Read [Markdown and layouts](../markdown-and-layouts/) to customize documentation pages.
- Read [React islands](../react-islands/) to add state and event handlers.
- Read [GitHub Pages](../github-pages/) before deploying below a repository base path.
