import { StrictMode, createElement, type ReactNode } from 'react'
import {
  IslandRenderContext,
  composedIslandRenderer,
  validateIslandModule,
  type IslandModule,
} from './islands'
import { parseIslandProps } from './island-serialization'
export {
  scheduleHydration,
  visibilityTargets,
  type HydrationEnvironment as IslandHydrationEnvironment,
  type ScheduledHydration,
} from './hydration-scheduler'

export interface IslandHydrateRootOptions {
  identifierPrefix: string
  onRecoverableError(error: unknown): void
}

export interface IslandReactRoot {
  unmount(): void
}

export type IslandHydrateRoot = (
  element: HTMLElement,
  content: ReactNode,
  options: IslandHydrateRootOptions,
) => IslandReactRoot

export interface IslandHydratorDependencies {
  loaders: ReadonlyMap<string, () => Promise<IslandModule>>
  hydrateRoot: IslandHydrateRoot
  reportError?: (id: string, instance: string, error: unknown) => void
}

export async function hydrateIsland(
  element: HTMLElement,
  dependencies: IslandHydratorDependencies,
): Promise<IslandReactRoot> {
  const id = element.dataset.island
  const instance = element.dataset.instance
  const identifierPrefix = element.dataset.prefix
  const serializedProps = element.dataset.props
  if (!id || !instance || !identifierPrefix || serializedProps === undefined) {
    throw new Error('Island element is missing hydration metadata')
  }

  const load = dependencies.loaders.get(id)
  if (!load) throw new Error(`No client module found for island ${id}`)
  const module = await load()
  const definition = validateIslandModule(`/src/islands/${id}.tsx`, module)
  const props = parseIslandProps(serializedProps)
  return dependencies.hydrateRoot(
    element,
    createElement(
      IslandRenderContext.Provider,
      { value: composedIslandRenderer() },
      createElement(
        StrictMode,
        null,
        createElement(definition.Component, props),
      ),
    ),
    {
      identifierPrefix,
      onRecoverableError(error) {
        if (dependencies.reportError) {
          dependencies.reportError(id, instance, error)
        } else {
          console.error(`Failed to hydrate island ${id} (${instance})`, error)
        }
      },
    },
  )
}
