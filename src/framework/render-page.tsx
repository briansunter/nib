import { StrictMode, createElement, type ReactNode } from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { serializeIslandProps } from './island-serialization'
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
}

function islandTree(island: CollectedIsland): ReactNode {
  return createElement(
    IslandRenderContext.Provider,
    { value: composedIslandRenderer() },
    createElement(
      StrictMode,
      null,
      createElement(island.definition.Component, island.props),
    ),
  )
}

export function renderReactPage(page: ReactNode): RenderedReactPage {
  const collected: CollectedIsland[] = []
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

  const collectedShell = renderToStaticMarkup(
    createElement(IslandRenderContext.Provider, { value: collector }, page),
  )
  if (collected.length === 0) return { html: collectedShell, islands: [] }

  for (const island of collected) {
    island.html = renderToString(islandTree(island), {
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
        dangerouslySetInnerHTML: { __html: island.html },
      })
    },
  }

  const html = renderToStaticMarkup(
    createElement(IslandRenderContext.Provider, { value: emitter }, page),
  )
  if (cursor !== collected.length) {
    throw new Error('Island render count changed between render passes')
  }

  return {
    html,
    islands: [...new Set(collected.map((island) => island.definition.islandId))],
  }
}
