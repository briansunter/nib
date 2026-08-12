---
title: Getting started
description: Install Nib, run the example site, and add your first page.
layout: docs
---

# Getting started

Build a working Nib site, add one static route, and opt into browser interaction only where the page needs it.

## 1. Scaffold a site

Run Nib’s scaffolding command with npm, Bun, pnpm, or another package runner:

```bash
npx @briansunter/nib init my-site
cd my-site
npm run dev
```

The command creates only your framework configuration and source files, installs dependencies, and leaves Nib as a versioned dependency. Framework routing, Vite integration, development SSR, prerendering, document generation, and client loading stay inside `@briansunter/nib`.

## 2. Set the site identity

Identity and navigation are application data. Put them in `src/site.ts`:

```ts
export const site = {
  name: 'My Site',
  description: 'A short description of my site.',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'Hello', href: '/hello/' },
  ],
} as const
```

Import this value from the site shell, footer, feed setup, or anywhere else
that needs it. Nib does not assign meaning to its keys.

If you want site-wide title and description policy, opt into the metadata
plugin from `nib.config.ts`:

```ts
import { defineConfig, siteMetadata } from '@briansunter/nib'
import { site } from './src/site'

export default defineConfig({
  plugins: [
    siteMetadata({
      title: site.name,
      description: site.description,
      titleTemplate: `%s | ${site.name}`,
    }),
  ],
})
```

Without this plugin, each page's metadata is emitted unchanged. Navigation
stays app-owned in either case.

## 3. Add an optional Vite adapter

Nib owns Vite’s entries, SSR, base path, and output settings. Add project-owned
Vite plugins through the narrow `vite` factory; it creates a fresh adapter for
each development, client, and server graph. The starter uses this for Tailwind:

```ts
import { defineConfig } from '@briansunter/nib'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  vite: () => tailwindcss(),
})
```

Use `plugins` only for packages that also need Nib build or rendering lifecycle
hooks, such as the image optimizer.

## 4. Add a TSX page

Create `src/pages/hello/page.tsx`:

```tsx
import type { PageMeta } from '@briansunter/nib'

export const meta = {
  title: 'Hello | My Site',
  description: 'A first page built with Nib.',
} satisfies PageMeta

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

The starter includes a counter enhancement. Attach it to the existing button in
the TSX page:

```tsx
import { enhance } from '@briansunter/nib'

export default function HelloPage() {
  return (
    <>
      <h1>Hello from Nib</h1>
      <button {...enhance('counter')} data-count="0" type="button">
        Count: 0
      </button>
    </>
  )
}
```

The matching `src/enhancements/counter/index.client.ts` module receives that
button and an `AbortSignal` as positional arguments. The rest of the page stays
static HTML. Follow the [client enhancements guide](../client-enhancements/)
for the complete DOM contract and optional React islands.

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
- Read [Client enhancements](../client-enhancements/) to add scoped DOM behavior or a React island.
- Read [GitHub Pages](../github-pages/) before deploying below a repository base path.
