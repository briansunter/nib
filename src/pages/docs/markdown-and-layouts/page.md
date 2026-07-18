---
title: Markdown and layouts
description: Write Markdown content and wrap it with reusable React layouts.
layout: docs
---

# Markdown and layouts

Use `page.md` for content-heavy routes. YAML frontmatter supplies metadata and can select a named React layout.

```md
---
title: A documentation page
description: Explain one part of the project.
layout: docs
---

# A documentation page

GitHub-Flavored Markdown is rendered at build time.
```

## Layouts

Create a layout under `src/layouts`:

```tsx
import type { ReactNode } from 'react'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <main className="prose prose-invert">{children}</main>
}
```

Select it with `layout: docs`. Layout names are flat filenames; nested layout paths are intentionally unsupported. The layout receives the rendered article as `children`.

Markdown supports tables, task lists, autolinks, strikethrough, and the rest of the configured GFM syntax.
