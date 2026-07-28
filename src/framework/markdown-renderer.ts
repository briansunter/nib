import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import type { MarkdownDefinition, MarkdownSourceContext } from './types'

/** The shared synchronous Markdown pipeline for file pages and content values. */
export function renderMarkdown(
  markdown: string,
  definition?: MarkdownDefinition<any>,
  context?: MarkdownSourceContext,
): string {
  const processor = unified().use(remarkParse)
  if (definition?.gfm !== false) processor.use(remarkGfm)
  processor
    .use([...(definition?.remarkPlugins ?? [])])
    .use(remarkRehype, {
      allowDangerousHtml: definition?.allowDangerousHtml ?? false,
    })
    .use([...(definition?.rehypePlugins ?? [])])
    .use(rehypeStringify, {
      allowDangerousHtml: definition?.allowDangerousHtml ?? false,
    })
  return String(processor.processSync(
    context === undefined
      ? markdown
      : { value: markdown, path: context.file },
  ))
}
