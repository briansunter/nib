import { StrictMode, createElement, type ReactNode } from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { BehaviorRenderContext } from './behaviors'
import { serializeIslandProps } from './island-serialization'
import {
  MarkdownContentRenderContext,
  type MarkdownContent,
} from './markdown-content'
import {
  IslandRenderContext,
  composedIslandRenderer,
  type HydrationStrategy,
  type IslandDefinition,
  type IslandRenderRequest,
  type IslandRenderer,
} from './islands'

interface CollectedIsland {
  definition: IslandDefinition<any>
  props: Record<string, unknown>
  serializedProps: string
  hydrate: HydrationStrategy
  instanceId: string
  identifierPrefix: string
  html: string
}

export interface RenderedReactPage {
  html: string
  islands: string[]
  behaviors: string[]
}

function contentRenderTree(
  page: ReactNode,
  islandRenderer: IslandRenderer,
  behaviors: Set<string>,
): { tree: ReactNode; rendered: Set<MarkdownContent> } {
  const rendered = new Set<MarkdownContent>()
  return {
    rendered,
    tree: createElement(
      MarkdownContentRenderContext.Provider,
      { value: { rendered } },
      createElement(
        IslandRenderContext.Provider,
        { value: islandRenderer },
        createElement(BehaviorRenderContext.Provider, { value: behaviors }, page),
      ),
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

function islandTree(island: CollectedIsland, behaviors: Set<string>): ReactNode {
  return contentRenderTree(
    createElement(
      StrictMode,
      null,
      createElement(island.definition.Component, island.props),
    ),
    composedIslandRenderer(),
    behaviors,
  ).tree
}

export function renderReactPage(
  page: ReactNode,
  requiredContent: readonly MarkdownContent[] = [],
): RenderedReactPage {
  const collected: CollectedIsland[] = []
  const behaviors = new Set<string>()
  const collector: IslandRenderer = {
    render(request: IslandRenderRequest) {
      const index = collected.length
      const instanceId = `nib-${index}`
      collected.push({
        definition: request.definition,
        props: request.props,
        serializedProps: serializeIslandProps(request.props),
        hydrate: request.hydrate,
        instanceId,
        identifierPrefix: `${instanceId}-`,
        html: '',
      })
      return null
    },
  }

  const collectedTree = contentRenderTree(page, collector, behaviors)
  const collectedShell = renderToStaticMarkup(collectedTree.tree)
  assertRequiredContent(collectedTree.rendered, requiredContent)
  if (collected.length === 0) {
    return { html: collectedShell, islands: [], behaviors: [...behaviors] }
  }

  for (const island of collected) {
    island.html = renderToString(islandTree(island, behaviors), {
      identifierPrefix: island.identifierPrefix,
    })
  }

  let cursor = 0
  const emitter: IslandRenderer = {
    render(request: IslandRenderRequest) {
      const island = collected[cursor]
      cursor += 1
      if (!island) throw new Error('Island render was not deterministic between passes')

      const serializedProps = serializeIslandProps(request.props)
      if (
        island.definition !== request.definition
        || island.hydrate !== request.hydrate
        || island.serializedProps !== serializedProps
      ) {
        throw new Error(`Island ${request.definition.islandId} changed between render passes`)
      }

      return createElement('nib-island', {
        'data-island': island.definition.islandId,
        'data-instance': island.instanceId,
        'data-prefix': island.identifierPrefix,
        'data-hydrate': island.hydrate,
        'data-props': island.serializedProps,
        style: { display: 'contents' },
        dangerouslySetInnerHTML: { __html: island.html },
      })
    },
  }

  const emittedTree = contentRenderTree(page, emitter, behaviors)
  const html = renderToStaticMarkup(emittedTree.tree)
  assertRequiredContent(emittedTree.rendered, requiredContent)
  if (cursor !== collected.length) {
    throw new Error('Island render count changed between render passes')
  }

  return {
    html,
    islands: [...new Set(collected.map((island) => island.definition.islandId))],
    behaviors: [...behaviors],
  }
}
