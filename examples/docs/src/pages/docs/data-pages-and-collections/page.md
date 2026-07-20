---
title: Data pages and collections
description: Render YAML, CSV, or any custom format as typed static pages and lists.
layout: docs
---

# Data pages and collections

Nib can discover any `src/pages/**/page.<extension>` file, or explicitly named
glob patterns such as `/src/content/projects.json`, validate its data, and
prerender one route or many routes. The framework does not need to know what
YAML, CSV, TOML, JSON, or your own format means. A page source supplies that
small format-specific seam.

## One file, one page

Define the data shape and static React component:

```tsx
// src/team.tsx
import { z, type DataPageProps } from '@briansunter/nib'

export const memberSchema = z.object({
  name: z.string(),
  role: z.string(),
})

export function MemberPage({
  data,
}: DataPageProps<z.infer<typeof memberSchema>>) {
  return <h1>{data.name}, {data.role}</h1>
}
```

Register a YAML handler in `nib.config.ts`:

```tsx
import { defineConfig, definePageSource } from '@briansunter/nib'
import { parse } from 'yaml'
import { MemberPage, memberSchema } from './src/team'

export default defineConfig({
  site: { title: 'People' },
  pageSources: [
    definePageSource({
      extensions: ['yaml', 'yml'],
      schema: memberSchema,
      load: ({ source }) => ({ data: parse(source) }),
      component: MemberPage,
    }),
  ],
})
```

Now `src/pages/team/page.yaml` becomes `/team/`, exactly as `page.md` does:

```yaml
name: Ada
role: Engineer
```

Omit `path` to use the containing folder. A descriptor may also provide `meta` and a named `layout`.

## One CSV, many pages

Return an array to create several routes from one file:

```tsx
definePageSource({
  extensions: ['csv'],
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    price: z.coerce.number(),
  }),
  load: ({ source }) =>
    parseCsv(source, { columns: true, skip_empty_lines: true })
      .map((data: { slug: string }) => ({
        path: `/products/${data.slug}`,
        data,
        meta: { title: data.name },
      })),
  component: ProductPage,
})
```

`src/pages/products/page.csv` can therefore emit `/products/pencil/`, `/products/notebook/`, and any other build-time route. Duplicate routes, unsafe paths, invalid data, and overlapping handlers fail the build with the source filename.

Use `match(file)` when two handlers share an extension:

```tsx
definePageSource({
  extensions: ['yaml'],
  match: (file) => file.includes('/src/pages/recipes/'),
  // schema, load, component
})
```

For a source outside `src/pages`, add `patterns` and keep `match` as the final
ownership check. The generated module receives the file contents through the
same `PageSourceContext`:

```tsx
definePageSource({
  extensions: ['json'],
  patterns: ['/src/content/projects.json'],
  match: (file) => file.endsWith('/src/content/projects.json'),
  load: ({ source }) => JSON.parse(source).map((data) => ({
    path: `/projects/${data.slug}`,
    data,
  })),
  component: ProjectPage,
})
```

## Validators

Zod 4 is included and re-exported as `z`. A `schema` can be any object with `parse(value)`, so other parse-compatible validators work too. For complete control, replace `schema` with a typed `validate(value, context)` function. Choose one validation adapter per definition.

Validation runs during development module loading and production prerendering. Zod transforms such as `z.coerce.number()` and `z.coerce.date()` reach the page component as their transformed types.

## Typed collections

Collections load build-time data for indexes, navigation, related-content lists, and other cross-page queries:

```tsx
// src/content.ts
import { defineCollection, glob, z } from '@briansunter/nib'
import { parse } from 'yaml'

export const posts = defineCollection({
  loader: glob({
    base: 'src/content/posts',
    pattern: '**/*.yaml',
    load: ({ source }) => parse(source),
  }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    published: z.coerce.date(),
  }),
})
```

Register it once:

```tsx
import { posts } from './src/content'

export default defineConfig({
  site: { title: 'Journal' },
  collections: { posts },
})
```

Use the config type to infer every collection entry:

```tsx
import type { PageProps } from '@briansunter/nib'
import type config from '../../nib.config'

export default function BlogIndex({
  collections,
}: PageProps<typeof config>) {
  return (
    <ul>
      {collections.posts.map((post) => (
        <li key={post.id}>
          {post.data.title} — {post.data.published.toDateString()}
        </li>
      ))}
    </ul>
  )
}
```

`glob()` recursively loads one entry per matching file and derives its `id` from the relative path. `file()` handles one file that returns either `{ id: data }` or an array of `{ id, data }`. A collection may instead provide any async loader function and use its `root` and `read()` context.

## Folder layouts and typed frontmatter

Add `src/pages/layout.tsx` for the whole site or `src/pages/blog/layout.tsx` for the blog subtree. Layouts compose from root to leaf, followed by an optional frontmatter-selected layout.

A Markdown schema makes arbitrary YAML frontmatter available to those layouts:

```tsx
export const articleSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  layout: z.string().optional(),
})

export const markdown = defineMarkdown({ schema: articleSchema })
```

```tsx
import { z, type PageLayoutProps } from '@briansunter/nib'
import { articleSchema } from '../../content'

export default function BlogLayout({
  children,
  frontmatter,
}: PageLayoutProps<z.infer<typeof articleSchema>>) {
  return (
    <article>
      <p>{frontmatter?.tags.join(' · ')}</p>
      {children}
    </article>
  )
}
```

Data-page layouts receive the validated value as `data`; Markdown layouts receive it as `frontmatter`. Both also receive `route`, `site`, and typed `collections`.
