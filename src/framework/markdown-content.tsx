import {
  createContext,
  createElement,
  useContext,
  type ComponentType,
  type HTMLAttributes,
} from 'react'
import { renderMarkdown } from './markdown-renderer'
import type { MarkdownDefinition } from './types'

const markdownContentBrand: unique symbol = Symbol.for('@briansunter/nib/markdown-content') as never

/** Compiled, framework-owned Markdown that can only be rendered by Content. */
export interface MarkdownContent {
  readonly kind: 'nib-markdown-content'
  readonly source: string
  readonly html: string
  readonly [markdownContentBrand]: true
}

export interface MarkdownBodyOptions {
  /** Stable source identity used by Unified plugins and build diagnostics. */
  readonly file: string
  /** Optional deterministic Markdown profile. Defaults to Nib's GFM profile. */
  readonly profile?: MarkdownDefinition<any>
}

export type ContentRootTag = 'article' | 'div' | 'main' | 'section'

export interface ContentRootProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'children' | 'dangerouslySetInnerHTML'
> {
  readonly as?: ContentRootTag
}

export interface ContentProps extends ContentRootProps {
  readonly body: MarkdownContent
}

export type ContentRenderer = ComponentType<ContentRootProps>

interface ContentRenderState {
  readonly rendered: Set<MarkdownContent>
}

/** @internal A fresh instance is installed for each server render pass. */
export const MarkdownContentRenderContext = createContext<ContentRenderState | undefined>(undefined)

function sourceIdentity(file: unknown): string {
  if (typeof file !== 'string' || file.trim() === '') {
    throw new Error('markdownBody file must be a non-empty source identity')
  }
  return file
}

/** @internal Wrap already compiled HTML from the file-page compiler. */
export function compiledMarkdownContent(html: string, file: string): MarkdownContent {
  return Object.freeze({
    kind: 'nib-markdown-content' as const,
    source: sourceIdentity(file),
    html,
    [markdownContentBrand]: true as const,
  })
}

/** Compiles generated-page Markdown with the same pipeline as file pages. */
export async function markdownBody(source: string, options: MarkdownBodyOptions): Promise<MarkdownContent> {
  if (typeof source !== 'string') throw new Error('markdownBody source must be a string')
  const file = sourceIdentity(options?.file)
  try {
    return compiledMarkdownContent(
      await renderMarkdown(source, options.profile, { file }),
      file,
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Markdown body ${file}: ${detail}`, { cause: error })
  }
}

export function isMarkdownContent(value: unknown): value is MarkdownContent {
  return value !== null
    && typeof value === 'object'
    && (value as { kind?: unknown }).kind === 'nib-markdown-content'
    && (value as { source?: unknown }).source !== ''
    && typeof (value as { source?: unknown }).source === 'string'
    && typeof (value as { html?: unknown }).html === 'string'
    && (value as { [markdownContentBrand]?: unknown })[markdownContentBrand] === true
}

function validateRootProps(props: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(props)) {
    if (name === 'children' || name === 'dangerouslySetInnerHTML') {
      throw new Error(`Nib Content owns its ${name} prop`)
    }
    if (/^on[A-Z]/.test(name) && typeof value === 'function') {
      throw new Error(`Nib Content root props must be static; received ${name}`)
    }
  }
}

/** Renders a compiled Markdown value exactly once in the current page pass. */
export function Content({ body, as = 'article', ...rootProps }: ContentProps) {
  if (!isMarkdownContent(body)) throw new Error('Nib Content requires a value from markdownBody()')
  validateRootProps(rootProps)
  const state = useContext(MarkdownContentRenderContext)
  if (state?.rendered.has(body)) {
    throw new Error(`Markdown content ${body.source} rendered more than once`)
  }
  state?.rendered.add(body)
  return createElement(as, {
    ...rootProps,
    dangerouslySetInnerHTML: { __html: body.html },
  })
}

/** @internal Binds a route's compiled body for its page and layout components. */
export function createContentRenderer(body: MarkdownContent): ContentRenderer {
  function BoundContent(props: ContentRootProps) {
    return createElement(Content, { ...props, body })
  }
  BoundContent.displayName = 'NibContent'
  return BoundContent
}
