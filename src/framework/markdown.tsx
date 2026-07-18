import matter from 'gray-matter'
import type { ComponentType } from 'react'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import type { MarkdownLayout, PageMeta, PageModule } from './types'

export function renderMarkdown(markdown: string): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify)
      .processSync(markdown),
  )
}

export function markdownToCompiledPage(source: string) {
  const parsed = matter(source)
  return {
    html: renderMarkdown(parsed.content),
    meta: parsed.data as PageMeta
  }
}

export function getMarkdownLayoutName(meta: PageMeta): string | undefined {
  if (meta.layout === undefined) return undefined
  if (typeof meta.layout !== 'string' || meta.layout.trim() === '') {
    throw new Error('Markdown layout must be a non-empty string')
  }

  const name = meta.layout.trim().replaceAll('\\', '/')
  if (name.startsWith('/') || name.split('/').some((part) => part === '.' || part === '..' || part === '')) {
    throw new Error(`Markdown layout must be a relative name: ${meta.layout}`)
  }
  return name
}

export interface MarkdownPageOptions {
  layouts?: Record<string, MarkdownLayout>
}

export function markdownToPageModule(source: string, options: MarkdownPageOptions = {}): PageModule {
  const { html, meta } = markdownToCompiledPage(source)
  const layoutName = getMarkdownLayoutName(meta)
  const Layout = layoutName ? options.layouts?.[layoutName] : undefined
  if (layoutName && !Layout) {
    throw new Error(`Unknown Markdown layout "${layoutName}"`)
  }

  const MarkdownPage: ComponentType = () => (
    Layout ? (
      <Layout>
        <article
          className="prose prose-invert max-w-none prose-a:text-sky-300"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Layout>
    ) : (
      <article
        className="prose prose-invert max-w-none prose-a:text-sky-300"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  )
  return { default: MarkdownPage, meta }
}
