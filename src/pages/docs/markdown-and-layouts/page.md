---
title: Markdown and layouts
description: Write Markdown content and wrap it with reusable React layouts.
layout: docs
---

# Markdown and layouts

Use `page.md` for guides, articles, and documentation. Nib parses frontmatter and renders Markdown to HTML during development and the production build.

## Frontmatter

```md
---
title: A documentation page
description: Explain one part of the project.
layout: docs
---

# A documentation page

GitHub-Flavored Markdown is rendered at build time.
```

The supported fields are:

| Field | Purpose |
| --- | --- |
| `title` | Page title and metadata. |
| `description` | Search and social description. |
| `draft` | Omit the page when `true`. |
| `layout` | Select a React layout by flat filename. |

Remark GFM supports tables, task lists, autolinks, and strikethrough.

## Create a layout

Create `src/layouts/docs.tsx`:

```tsx
import type { ReactNode } from 'react'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="prose prose-invert">
      {children}
    </main>
  )
}
```

Select it with `layout: docs`. The layout receives the rendered article as `children`, so it can add navigation, a sidebar, or other static TSX around the article.

Layouts may place [React islands](../react-islands/) before, after, or beside those children. Inline JSX inside `page.md` is not supported.

Layout names are flat filenames. `src/layouts/docs.tsx` works; nested layout paths are intentionally unsupported.

## Markdown page versus TSX page

Choose a Markdown page when the route is primarily content. Choose a TSX page when it needs custom static component composition or a page-specific structure. Put browser state and event handlers in an explicit React island. Both page types are server-rendered and become static HTML in `dist/client`.
