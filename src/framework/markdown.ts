import matter from 'gray-matter'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import type { PageMeta } from './types'

function renderMarkdown(markdown: string): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify)
      .processSync(markdown),
  )
}

function getMarkdownLayoutName(layout: unknown): string | undefined {
  if (layout === undefined) return undefined
  if (typeof layout !== 'string' || layout.trim() === '') {
    throw new Error('Markdown layout must be a non-empty string')
  }

  const name = layout.trim()
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new Error(`Markdown layout must be a flat name: ${layout}`)
  }
  return name
}

export function markdownToCompiledPage(source: string) {
  const parsed = matter(source)
  const { layout, ...meta } = parsed.data as PageMeta & { layout?: unknown }
  return {
    html: renderMarkdown(parsed.content),
    meta: meta as PageMeta,
    layout: getMarkdownLayoutName(layout)
  }
}
