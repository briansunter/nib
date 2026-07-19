import matter from 'gray-matter'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { defaultMarkdownSchema, parseData } from './content'
import type {
  DataSchema,
  DataValidator,
  InferDataValidator,
  MarkdownDefinition,
  PageMeta,
} from './types'

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

function getMarkdownMeta(
  values: Record<string, unknown>,
): { meta: PageMeta; layout: string | undefined } {
  const { title, description, draft, layout } = values
  return {
    meta: {
      ...(title === undefined ? {} : { title: title as string }),
      ...(description === undefined ? {} : { description: description as string }),
      ...(draft === undefined ? {} : { draft: draft as boolean }),
    },
    layout: getMarkdownLayoutName(layout),
  }
}

export function markdownToCompiledPage<
  Validator extends DataValidator = typeof defaultMarkdownSchema,
>(
  source: string,
  definition?: MarkdownDefinition<Validator>,
) {
  const parsed = matter(source)
  const frontmatter = definition
    ? parseData<InferDataValidator<Validator>>(parsed.data, {
        ...(definition.schema
          ? { schema: definition.schema as DataSchema<InferDataValidator<Validator>> }
          : {}),
        ...(definition.validate ? { validate: definition.validate } : {}),
        label: 'Markdown frontmatter',
      })
    : parseData(parsed.data, {
        schema: defaultMarkdownSchema,
        label: 'Markdown frontmatter',
      })
  const values = parseData(frontmatter, {
    schema: defaultMarkdownSchema,
    label: 'Markdown page fields',
  })
  const { meta, layout } = getMarkdownMeta(values)
  return {
    html: renderMarkdown(parsed.content),
    frontmatter,
    meta,
    layout,
  }
}
