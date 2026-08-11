import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BehaviorRenderContext } from './behaviors'
import { htmlAttribute, parseHtmlDocument } from './html-document'
import {
  MarkdownContentRenderContext,
  type MarkdownContent,
} from './markdown-content'

export interface RenderedReactPage {
  html: string
  behaviors: string[]
}

function assertRequiredContent(
  rendered: ReadonlySet<MarkdownContent>,
  required: readonly MarkdownContent[],
): void {
  for (const body of required) {
    if (!rendered.has(body)) {
      throw new Error(`Markdown content ${body.source} was not rendered by its page or layouts`)
    }
  }
}

function assertBehaviorMarkers(
  html: string,
  expected: ReadonlyMap<string, number>,
): void {
  const actual = new Map<string, number>()
  let reservedDeferWithoutBehavior = false
  let foreignNamespaceRoot = false
  for (const element of parseHtmlDocument(html).elements) {
    const id = htmlAttribute(element, 'data-nib-behavior')
    const defer = htmlAttribute(element, 'data-nib-defer')
    if (id === undefined) {
      if (defer !== undefined) reservedDeferWithoutBehavior = true
      continue
    }
    if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      foreignNamespaceRoot = true
    }
    actual.set(id, (actual.get(id) ?? 0) + 1)
  }
  if (foreignNamespaceRoot) {
    throw new Error('Behavior roots must be HTML elements')
  }
  const matches = !reservedDeferWithoutBehavior
    && actual.size === expected.size
    && [...expected].every(([id, count]) => actual.get(id) === count)
  if (!matches) {
    throw new Error(
      'data-nib-behavior and data-nib-defer are framework-owned; '
      + 'declare client enhancements with <Behavior>',
    )
  }
}

export function renderReactPage(
  page: ReactNode,
  requiredContent: readonly MarkdownContent[] = [],
): RenderedReactPage {
  const behaviors = new Map<string, number>()
  const rendered = new Set<MarkdownContent>()
  const tree = createElement(
    MarkdownContentRenderContext.Provider,
    { value: { rendered } },
    createElement(BehaviorRenderContext.Provider, { value: behaviors }, page),
  )
  const html = renderToStaticMarkup(tree)
  assertRequiredContent(rendered, requiredContent)
  assertBehaviorMarkers(html, behaviors)
  return { html, behaviors: [...behaviors.keys()] }
}
