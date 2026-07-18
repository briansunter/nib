import { StrictMode, createElement, type ReactNode } from 'react'
import type { HydrationStrategy } from './islands'
import {
  IslandRenderContext,
  nestedIslandRenderer,
  validateIslandModule,
  type IslandModule,
} from './islands'
import { parseIslandProps } from './island-serialization'

export interface IslandHydrationEnvironment {
  requestIdleCallback?: (callback: () => void) => number
  setTimeout: (callback: () => void, delay: number) => unknown
  IntersectionObserver?: typeof window.IntersectionObserver
}

export interface IslandHydrateRootOptions {
  identifierPrefix: string
  onRecoverableError(error: unknown): void
}

export type IslandHydrateRoot = (
  element: HTMLElement,
  content: ReactNode,
  options: IslandHydrateRootOptions,
) => unknown

export interface IslandHydratorDependencies {
  loaders: ReadonlyMap<string, () => Promise<IslandModule>>
  hydrateRoot: IslandHydrateRoot
  reportError?: (id: string, instance: string, error: unknown) => void
}

export async function hydrateIsland(
  element: HTMLElement,
  dependencies: IslandHydratorDependencies,
): Promise<void> {
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
  dependencies.hydrateRoot(
    element,
    createElement(
      IslandRenderContext.Provider,
      { value: nestedIslandRenderer(id) },
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

export function visibilityTargets(element: HTMLElement): Element[] {
  const children = [...element.children]
  return children.length > 0 ? children : [element.parentElement ?? element]
}

export function scheduleHydration(
  element: HTMLElement,
  strategy: HydrationStrategy,
  hydrate: () => void,
  environment: IslandHydrationEnvironment = window,
): void {
  let didHydrate = false
  const hydrateOnce = () => {
    if (didHydrate) return
    didHydrate = true
    hydrate()
  }

  if (strategy === 'load') {
    hydrateOnce()
    return
  }
  if (strategy === 'idle') {
    if (typeof environment.requestIdleCallback === 'function') {
      environment.requestIdleCallback(hydrateOnce)
    } else {
      environment.setTimeout(hydrateOnce, 1)
    }
    return
  }

  if (!environment.IntersectionObserver) {
    hydrateOnce()
    return
  }

  const observer = new environment.IntersectionObserver((entries) => {
    if (didHydrate || !entries.some((entry) => entry.isIntersecting)) return
    observer.disconnect()
    hydrateOnce()
  }, { rootMargin: '200px' })
  for (const target of visibilityTargets(element)) observer.observe(target)
}
