import matter from 'gray-matter'
import { defaultMarkdownSchema, parseData } from './content'
import { compiledMarkdownContent } from './markdown-content'
import { renderMarkdown } from './markdown-renderer'
import { normalizeHeadContribution } from './meta'
import type {
  DataSchema,
  DataValidator,
  InferDataValidator,
  MarkdownDefinition,
  MarkdownSourceContext,
  MetadataImage,
  PageMeta,
} from './types'

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
  const { title, description, draft, layout, head, image, type, twitterCard } = values
  const normalizedHead = normalizeHeadContribution(head, 'Markdown page head')
  return {
    meta: {
      title: title as string,
      ...(description === undefined ? {} : { description: description as string }),
      ...(draft === undefined ? {} : { draft: draft as boolean }),
      ...(normalizedHead === undefined ? {} : { head: normalizedHead }),
      ...(image === undefined ? {} : { image: image as MetadataImage }),
      ...(type === undefined ? {} : { type: type as 'website' | 'article' }),
      ...(twitterCard === undefined ? {} : { twitterCard: twitterCard as 'summary' | 'summary_large_image' }),
    },
    layout: getMarkdownLayoutName(layout),
  }
}

export async function markdownToCompiledPage<
  Validator extends DataValidator = typeof defaultMarkdownSchema,
>(
  source: string,
  definition?: MarkdownDefinition<Validator>,
  context?: MarkdownSourceContext,
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
  let resolvedMeta = meta
  if (definition?.meta !== undefined) {
    const override = definition.meta({
      frontmatter: frontmatter as never,
      path: context?.file ?? '',
      source: parsed.content,
      defaults: meta,
    })
    if (override !== undefined) resolvedMeta = override
  }
  const html = await renderMarkdown(parsed.content, definition, context)
  return {
    html,
    content: compiledMarkdownContent(html, context?.file ?? 'inline Markdown page'),
    frontmatter,
    meta: resolvedMeta,
    layout,
  }
}
