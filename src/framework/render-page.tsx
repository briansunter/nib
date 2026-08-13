import { StrictMode, createElement, type ReactNode } from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import {
  parseFragment,
  serialize,
  type DefaultTreeAdapterTypes,
} from 'parse5'
import { validateEnhancementId } from './enhancement-paths'
import {
  htmlAttribute,
  parseHtmlDocument,
  type HtmlElementNode,
  type ParsedHtmlDocument,
} from './html-document'
import { parseIslandProps, serializeIslandProps } from './island-serialization'
import {
  IslandRenderContext,
  composedIslandRenderer,
  islandDefinitionComponent,
  islandDefinitionId,
  type IslandDefinition,
  type IslandHydrationStrategy,
  type IslandRenderRequest,
  type IslandRenderer,
} from './islands'
import {
  MarkdownContentRenderContext,
  type MarkdownContent,
} from './markdown-content'
import type { RenderedEnhancement, RenderedIsland } from './types'

interface CollectedIsland {
  definition: IslandDefinition<any>
  props: Record<string, unknown>
  serializedProps: string
  when: IslandHydrationStrategy
  instanceId: string
  identifierPrefix: string
  html: string
}

export interface RenderedReactPage {
  html: string
  enhancements: RenderedEnhancement[]
  islands: RenderedIsland[]
}

function contentRenderTree(
  page: ReactNode,
  islandRenderer: IslandRenderer,
): { tree: ReactNode; rendered: Set<MarkdownContent> } {
  const rendered = new Set<MarkdownContent>()
  return {
    rendered,
    tree: createElement(
      MarkdownContentRenderContext.Provider,
      { value: { rendered } },
      createElement(IslandRenderContext.Provider, { value: islandRenderer }, page),
    ),
  }
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

function isHtmlElement(
  node: DefaultTreeAdapterTypes.Node | null | undefined,
): node is HtmlElementNode {
  return node !== null && node !== undefined && 'tagName' in node
}

function inertTemplateElements(
  document: ParsedHtmlDocument,
): ReadonlySet<HtmlElementNode> {
  const inert = new Set<HtmlElementNode>()
  const visit = (
    node: DefaultTreeAdapterTypes.Node,
    insideTemplate: boolean,
  ): void => {
    if (isHtmlElement(node) && insideTemplate) inert.add(node)
    for (const child of 'childNodes' in node ? node.childNodes : []) {
      visit(child, insideTemplate)
    }
    if (isHtmlElement(node) && node.tagName === 'template' && 'content' in node) {
      for (const child of node.content.childNodes) visit(child, true)
    }
  }
  visit(document.document, false)
  return inert
}

function hasEnhancementMarker(element: HtmlElementNode): boolean {
  return htmlAttribute(element, 'data-nib-enhancement') !== undefined
}

function hasIslandMarker(element: HtmlElementNode): boolean {
  return element.tagName === 'nib-island'
    || htmlAttribute(element, 'data-nib-island') !== undefined
    || htmlAttribute(element, 'data-nib-instance') !== undefined
    || htmlAttribute(element, 'data-nib-prefix') !== undefined
    || htmlAttribute(element, 'data-nib-props') !== undefined
}

function hasClientMarker(element: HtmlElementNode): boolean {
  return hasEnhancementMarker(element)
    || hasIslandMarker(element)
    || htmlAttribute(element, 'data-nib-when') !== undefined
}

function parentElement(element: HtmlElementNode): HtmlElementNode | undefined {
  return isHtmlElement(element.parentNode) ? element.parentNode : undefined
}

function assertClientMarkerPlacement(document: ParsedHtmlDocument): void {
  const inert = inertTemplateElements(document)
  for (const element of document.elements) {
    if (!hasClientMarker(element)) continue
    if (inert.has(element)) {
      throw new Error('Nib client markers cannot be placed inside inert <template> content')
    }

    const enhancement = hasEnhancementMarker(element)
    const island = hasIslandMarker(element)
    if (enhancement && island) {
      throw new Error('Enhancement and island roots cannot contain one another')
    }
    for (
      let ancestor = parentElement(element);
      ancestor !== undefined;
      ancestor = parentElement(ancestor)
    ) {
      if (
        (enhancement && hasIslandMarker(ancestor))
        || (island && hasEnhancementMarker(ancestor))
      ) {
        throw new Error('Enhancement and island roots cannot contain one another')
      }
    }
  }
}

/**
 * Final HTML is the enhancement declaration source of truth. This validates
 * helper-authored and raw HTML from every React boundary through one parser.
 */
function inspectEnhancements(document: ParsedHtmlDocument): RenderedEnhancement[] {
  const enhancements: RenderedEnhancement[] = []
  for (const element of document.elements) {
    const rawId = htmlAttribute(element, 'data-nib-enhancement')
    const rawWhen = htmlAttribute(element, 'data-nib-when')
    if (rawId === undefined) {
      if (
        rawWhen !== undefined
        && htmlAttribute(element, 'data-nib-island') === undefined
      ) {
        throw new Error('data-nib-when requires data-nib-enhancement on the same HTML element')
      }
      continue
    }
    if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      throw new Error(`Enhancement ${JSON.stringify(rawId)} must be attached to an HTML element`)
    }
    const id = validateEnhancementId(rawId)
    if (rawWhen !== undefined && rawWhen !== 'visible') {
      throw new Error(
        `Invalid enhancement timing for ${id}: ${JSON.stringify(rawWhen)}`,
      )
    }
    enhancements.push(Object.freeze({
      id,
      when: rawWhen === 'visible' ? 'visible' : 'load',
    }))
  }
  return enhancements
}

function inspectIslands(
  document: ParsedHtmlDocument,
  collected: readonly CollectedIsland[],
): RenderedIsland[] {
  const rendered = document.elements.filter((element) => (
    element.tagName === 'nib-island'
    || htmlAttribute(element, 'data-nib-island') !== undefined
    || htmlAttribute(element, 'data-nib-instance') !== undefined
    || htmlAttribute(element, 'data-nib-prefix') !== undefined
    || htmlAttribute(element, 'data-nib-props') !== undefined
  ))
  if (rendered.length !== collected.length) {
    throw new Error(
      'React island boundaries must be authored with island() and rendered by Nib',
    )
  }

  const islands = new Map<string, RenderedIsland>()
  for (let index = 0; index < collected.length; index += 1) {
    const expected = collected[index]!
    const element = rendered[index]!
    const metadataMatches = (
      element.tagName === 'nib-island'
      && element.namespaceURI === 'http://www.w3.org/1999/xhtml'
      && htmlAttribute(element, 'data-nib-island') === islandDefinitionId(expected.definition)
      && htmlAttribute(element, 'data-nib-instance') === expected.instanceId
      && htmlAttribute(element, 'data-nib-prefix') === expected.identifierPrefix
      && htmlAttribute(element, 'data-nib-when') === expected.when
      && htmlAttribute(element, 'data-nib-props') === expected.serializedProps
    )
    const normalizedExpectedHtml = serialize(parseFragment(expected.html))
    if (!metadataMatches || serialize(element) !== normalizedExpectedHtml) {
      throw new Error(
        `Island ${islandDefinitionId(expected.definition)} cannot be rendered in this HTML context. `
        + 'Place the island in normal flow content, or make the containing table, '
        + 'select, or other restricted structure the island root.',
      )
    }
    const id = islandDefinitionId(expected.definition)
    islands.set(id, Object.freeze({
      id,
      when: expected.when,
    }))
  }
  return [...islands.values()]
}

function inspectRenderedHtml(
  html: string,
  collected: readonly CollectedIsland[],
): Pick<RenderedReactPage, 'enhancements' | 'islands'> {
  const document = parseHtmlDocument(html)
  assertClientMarkerPlacement(document)
  return {
    enhancements: inspectEnhancements(document),
    islands: inspectIslands(document, collected),
  }
}

function islandTree(island: CollectedIsland): ReactNode {
  return createElement(
    IslandRenderContext.Provider,
    { value: composedIslandRenderer() },
    createElement(
      StrictMode,
      null,
      createElement(islandDefinitionComponent(island.definition), island.props),
    ),
  )
}

export function renderReactPage(
  page: ReactNode,
  requiredContent: readonly MarkdownContent[] = [],
): RenderedReactPage {
  const collected: CollectedIsland[] = []
  const collector: IslandRenderer = {
    render(request: IslandRenderRequest) {
      if (islandDefinitionId(request.definition) === '') {
        throw new Error(
          'island(Component) must be the default export of a module under src/islands',
        )
      }
      const index = collected.length
      const instanceId = `nib-${index}`
      const serializedProps = serializeIslandProps(request.props)
      collected.push({
        definition: request.definition,
        // Match the browser's JSON parse semantics during server rendering.
        props: parseIslandProps(serializedProps),
        serializedProps,
        when: request.when,
        instanceId,
        identifierPrefix: `${instanceId}-`,
        html: '',
      })
      return null
    },
  }

  const collectedTree = contentRenderTree(page, collector)
  const collectedShell = renderToStaticMarkup(collectedTree.tree)
  assertRequiredContent(collectedTree.rendered, requiredContent)
  if (collected.length === 0) {
    const inspected = inspectRenderedHtml(collectedShell, collected)
    return {
      html: collectedShell,
      ...inspected,
    }
  }

  for (const island of collected) {
    island.html = renderToString(islandTree(island), {
      identifierPrefix: island.identifierPrefix,
    })
  }

  let cursor = 0
  const emitter: IslandRenderer = {
    render(request: IslandRenderRequest) {
      const current = collected[cursor]
      cursor += 1
      if (current === undefined) {
        throw new Error('Island render count changed between render passes')
      }

      const serializedProps = serializeIslandProps(request.props)
      if (
        current.definition !== request.definition
        || current.when !== request.when
        || current.serializedProps !== serializedProps
      ) {
        throw new Error(`Island ${islandDefinitionId(request.definition)} changed between render passes`)
      }

      return createElement('nib-island', {
        'data-nib-island': islandDefinitionId(current.definition),
        'data-nib-instance': current.instanceId,
        'data-nib-prefix': current.identifierPrefix,
        'data-nib-when': current.when,
        'data-nib-props': current.serializedProps,
        style: { display: 'contents' },
        dangerouslySetInnerHTML: { __html: current.html },
      })
    },
  }

  const emittedTree = contentRenderTree(page, emitter)
  const html = renderToStaticMarkup(emittedTree.tree)
  assertRequiredContent(emittedTree.rendered, requiredContent)
  if (cursor !== collected.length) {
    throw new Error('Island render count changed between render passes')
  }

  const inspected = inspectRenderedHtml(html, collected)
  return {
    html,
    ...inspected,
  }
}
