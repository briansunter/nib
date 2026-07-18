---
title: Getting started
description: Install Nib, run the example site, and add your first page.
layout: docs
---

# Getting started

## 1. Install and run Nib

Install [Bun](https://bun.sh/), then clone the repository:

```bash
git clone https://github.com/briansunter/nib.git my-site
cd my-site
bun install
bun run dev
```

Open <http://localhost:5173>. Nib uses Vite for refresh and renders requests through its SSR entry point while you develop.

## 2. Add a React page

Create `src/pages/hello/page.tsx`:

```tsx
export default function HelloPage() {
  return <h1>Hello from Nib</h1>
}
```

Visit <http://localhost:5173/hello/>. The folder name becomes the URL, and the file must be named `page.tsx`.

## 3. Add a Markdown page

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

Visit <http://localhost:5173/notes/>. Use Markdown for content-heavy pages and TSX for custom static structure. Use a [React island](../react-islands/) for browser state and interactions.

## 4. Add interaction when needed

Nib includes a counter island at `src/islands/counter.tsx`. Import it into the React page from step 2:

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

## 5. Check a production build

```bash
bun run typecheck
bun run test
bun run build
bun run preview
```

The build writes the deployable site to `dist/client`. Preview it at the URL printed by Vite. Deploy that directory, not `dist/server`.

## Useful next steps

- Update `src/site.config.ts` for the title and navigation.
- Read [Pages and routes](../pages-and-routes/) for metadata, drafts, and fallback behavior.
- Read [React islands](../react-islands/) to add state and event handlers.
- Read [Markdown and layouts](../markdown-and-layouts/) to customize documentation pages.
