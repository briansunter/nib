---
title: Markdown and layouts
description: Write Markdown content and wrap it with reusable React layouts.
layout: docs
---

# Markdown and layouts

Use `page.md` for guides, articles, and documentation. Nib parses frontmatter and renders the Markdown to HTML during the build.

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

Select it with `layout: docs`. The layout receives the rendered article as `children`, so it can add a heading, sidebar, table of contents, or other React markup around the article.

Layouts may place [React islands](../react-islands/) before, after, or beside those children. Inline JSX inside `page.md` is not supported.

Layout names are flat filenames. `src/layouts/docs.tsx` works; nested layout paths are intentionally unsupported.

## Markdown versus React

Choose Markdown when the page is primarily content. Choose `page.tsx` when you need custom static React components or a page-specific layout. Put local state and event handlers in an explicit React island. Both page types are server-rendered and become static HTML in `dist/client`.
