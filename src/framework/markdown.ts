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

function getMarkdownMeta(data: unknown): { meta: PageMeta; layout: string | undefined } {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Markdown frontmatter must be a mapping')
  }

  const values = data as Record<string, unknown>
  const supported = new Set(['title', 'description', 'draft', 'layout'])
  for (const key of Object.keys(values)) {
    if (!supported.has(key)) throw new Error(`Unsupported Markdown frontmatter field: ${key}`)
  }

  if ('title' in values && typeof values.title !== 'string') {
    throw new Error('Markdown title must be a string')
  }
  if ('description' in values && typeof values.description !== 'string') {
    throw new Error('Markdown description must be a string')
  }
  if ('draft' in values && typeof values.draft !== 'boolean') {
    throw new Error('Markdown draft must be a boolean')
  }

  const { layout, ...meta } = values
  return {
    meta: meta as PageMeta,
    layout: getMarkdownLayoutName(layout),
  }
}

export function markdownToCompiledPage(source: string) {
  const parsed = matter(source)
  const { meta, layout } = getMarkdownMeta(parsed.data)
  return {
    html: renderMarkdown(parsed.content),
    meta,
    layout,
  }
}
