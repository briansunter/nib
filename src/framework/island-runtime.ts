import { StrictMode, createElement, type ReactNode } from 'react'
import { parseIslandProps } from './island-serialization'
import {
  IslandRenderContext,
  composedIslandRenderer,
  islandDefinitionComponent,
  validateIslandModule,
  type IslandModule,
} from './islands'
import { isIslandHydrationStrategy } from './island-strategy'

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
  signal?: AbortSignal
  shouldHydrate?: () => boolean
}

function assertHydrationIsActive(
  dependencies: Pick<IslandHydratorDependencies, 'signal' | 'shouldHydrate'>,
) {
  if (
    dependencies.signal?.aborted === true
    || dependencies.shouldHydrate?.() === false
  ) {
    throw new DOMException('Island hydration aborted', 'AbortError')
  }
}

export async function hydrateIsland(
  element: HTMLElement,
  dependencies: IslandHydratorDependencies,
): Promise<IslandReactRoot> {
  const id = element.dataset.nibIsland
  const instance = element.dataset.nibInstance
  const identifierPrefix = element.dataset.nibPrefix
  const serializedProps = element.dataset.nibProps
  const strategy = element.dataset.nibWhen
  if (
    !id
    || !instance
    || !identifierPrefix
    || serializedProps === undefined
    || !isIslandHydrationStrategy(strategy)
  ) {
    throw new Error('Island element is missing valid hydration metadata')
  }

  const load = dependencies.loaders.get(id)
  if (load === undefined) throw new Error(`No client module found for island ${id}`)
  assertHydrationIsActive(dependencies)
  const module = await load()
  assertHydrationIsActive(dependencies)
  const definition = validateIslandModule(`/src/islands/${id}.tsx`, module)
  if (definition.when !== strategy) {
    throw new Error(
      `Island hydration strategy mismatch for ${id}: expected ${definition.when}, received ${strategy}`,
    )
  }
  const props = parseIslandProps(serializedProps)
  assertHydrationIsActive(dependencies)
  return dependencies.hydrateRoot(
    element,
    createElement(
      IslandRenderContext.Provider,
      { value: composedIslandRenderer() },
      createElement(
        StrictMode,
        null,
        createElement(islandDefinitionComponent(definition), props),
      ),
    ),
    {
      identifierPrefix,
      onRecoverableError(error) {
        if (dependencies.reportError !== undefined) {
          dependencies.reportError(id, instance, error)
        } else {
          console.error(`Failed to hydrate island ${id} (${instance})`, error)
        }
      },
    },
  )
}
