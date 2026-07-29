import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import type { MarkdownDefinition, MarkdownSourceContext } from './types'

/** The shared Markdown pipeline for file pages and content values. Async so
 *  remark/rehype transformers (e.g. build-time Mermaid rendering) can await. */
export async function renderMarkdown(
  markdown: string,
  definition?: MarkdownDefinition<any>,
  context?: MarkdownSourceContext,
): Promise<string> {
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
  const file = await processor.process(
    context === undefined
      ? markdown
      : { value: markdown, path: context.file },
  )
  return String(file)
}
