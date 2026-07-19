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

Nib validates these built-in fields by default:

| Field | Purpose |
| --- | --- |
| `title` | Page title and metadata. |
| `description` | Search and social description. |
| `draft` | Omit the page when `true`. |
| `layout` | Select a React layout by flat filename. |

Remark GFM supports tables, task lists, autolinks, and strikethrough.

Define a custom frontmatter schema when a content type needs more fields:

```tsx
// src/content.ts
import { defineMarkdown, z } from '@briansunter/nib'

export const articleSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  draft: z.boolean().optional(),
  layout: z.string().optional(),
  tags: z.array(z.string()),
  published: z.coerce.date(),
})

export const markdown = defineMarkdown({ schema: articleSchema })
```

Register `markdown` in `nib.config.ts`. Nib re-exports Zod 4 and infers the transformed output. You may instead provide another parse-compatible schema or a `validate(value)` function; choose one validation adapter per definition.

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

It can also receive typed frontmatter:

```tsx
import { z, type PageLayoutProps } from '@briansunter/nib'
import { articleSchema } from '../content'

export default function ArticleLayout({
  children,
  frontmatter,
}: PageLayoutProps<z.infer<typeof articleSchema>>) {
  return <article data-tags={frontmatter?.tags.join(',')}>{children}</article>
}
```

Layouts may place [React islands](../react-islands/) before, after, or beside those children. Inline JSX inside `page.md` is not supported.

Layout names are flat filenames. `src/layouts/docs.tsx` works; nested layout paths are intentionally unsupported.

For folder-based composition, create `src/pages/layout.tsx` or a nested `src/pages/docs/layout.tsx`. Nib wraps a page with every matching folder layout from root to leaf, then applies its optional named layout. Folder layouts receive the same `PageLayoutProps`, including validated `frontmatter`, `route`, `site`, and collections.

## Markdown page versus TSX page

Choose a Markdown page when the route is primarily content. Choose a TSX page when it needs custom static component composition or a page-specific structure. Put browser state and event handlers in an explicit React island. Both page types are server-rendered and become static HTML in `dist/client`.
