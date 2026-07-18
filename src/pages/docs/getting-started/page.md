---
title: Getting started
description: Install Nib, run the example site, and add your first page.
layout: docs
---

# Getting started

## 1. Clone the starter

Install [Bun](https://bun.sh/), then clone the repository:

```bash
git clone https://github.com/briansunter/nib.git my-site
cd my-site
bun install
bun run dev
```

Open <http://localhost:5173>. Nib is a starter repository rather than a dependency you add to an existing app. Rename the clone, keep the source you need, and make it your site.

## 2. Set the site identity

Edit `src/site.config.ts`:

```ts
export default {
  title: 'My Site',
  description: 'A short description of my site.',
  titleTemplate: '%s | My Site',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'Hello', href: '/hello/' },
  ],
}
```

The site config supplies default metadata and header navigation.

## 3. Add a TSX page

Create `src/pages/hello/page.tsx`:

```tsx
export default function HelloPage() {
  return <h1>Hello from Nib</h1>
}
```

Visit <http://localhost:5173/hello/>. The folder name becomes the URL, and the file must be named `page.tsx`.

## 4. Add a Markdown page

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

## 5. Add interaction when needed

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

## 6. Check a production build

```bash
bun run typecheck
bun run test
bun run build
bun run preview
```

The build writes the deployable site to `dist/client`. `dist/server` is only an intermediate prerendering bundle. Preview the generated site at the URL printed by Vite.

## Useful next steps

- Read [Pages and routes](../pages-and-routes/) for metadata, drafts, and fallback behavior.
- Read [Markdown and layouts](../markdown-and-layouts/) to customize documentation pages.
- Read [React islands](../react-islands/) to add state and event handlers.
- Read [GitHub Pages](../github-pages/) before deploying below a repository base path.
