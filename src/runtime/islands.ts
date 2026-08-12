import { islandFileToId } from '../framework/island-paths'
import type { IslandModule } from '../framework/islands'
import {
  type IslandHydrateRoot,
  type IslandReactRoot,
} from '../framework/island-runtime'
import {
  scheduleIslandHydration,
  type IslandHydrationEnvironment,
  type ScheduledIslandHydration,
} from '../framework/island-scheduler'
import { isIslandHydrationStrategy } from '../framework/island-strategy'

export type IslandClientModules = Record<string, () => Promise<IslandModule>>

export interface IslandRuntime {
  /** Mounts the initial document or an explicitly supplied static root. */
  mount(root?: ParentNode): void
  /** Cancels pending visibility work and unmounts hydrated roots for HMR. */
  destroy(): void
}

export interface CreateIslandRuntimeOptions {
  hydrateRoot?: IslandHydrateRoot
  environment?: IslandHydrationEnvironment
  reportError?: (id: string, instance: string, error: unknown) => void
}

interface MountedIsland {
  active: boolean
  controller: AbortController
  scheduled?: ScheduledIslandHydration
  reactRoot?: IslandReactRoot
}

function defaultReportError(id: string, instance: string, error: unknown) {
  console.error(`Failed to hydrate island ${id} (${instance})`, error)
}

function elementsWithin(root: ParentNode): HTMLElement[] {
  const elements = [
    ...root.querySelectorAll<HTMLElement>('nib-island[data-nib-island]'),
  ]
  if (
    typeof HTMLElement !== 'undefined'
    && root instanceof HTMLElement
    && root.matches('nib-island[data-nib-island]')
  ) {
    elements.unshift(root)
  }
  return [...new Set(elements)]
}

function rootContains(root: ParentNode, element: HTMLElement): boolean {
  return typeof root.contains !== 'function' || root.contains(element)
}

function memoizeLoader(
  load: () => Promise<IslandModule>,
): () => Promise<IslandModule> {
  let loaded: Promise<IslandModule> | undefined
  return () => {
    loaded ??= Promise.resolve()
      .then(load)
      .catch((error: unknown) => {
        loaded = undefined
        throw error
      })
    return loaded
  }
}

type IslandHydrator = typeof import('../framework/island-runtime')['hydrateIsland']

function lazyHydrator(
  injectedHydrateRoot?: IslandHydrateRoot,
): () => Promise<{
  hydrateIsland: IslandHydrator
  hydrateRoot: IslandHydrateRoot
}> {
  let loaded: Promise<{
    hydrateIsland: IslandHydrator
    hydrateRoot: IslandHydrateRoot
  }> | undefined
  return () => {
    loaded ??= Promise.all([
      import('../framework/island-runtime'),
      injectedHydrateRoot === undefined
        ? import('react-dom/client').then((module) => module.hydrateRoot)
        : Promise.resolve(injectedHydrateRoot),
    ]).then(([runtime, hydrateRoot]) => ({
      hydrateIsland: runtime.hydrateIsland,
      hydrateRoot,
    })).catch((error: unknown) => {
      loaded = undefined
      throw error
    })
    return loaded
  }
}

function isAbortError(error: unknown): boolean {
  return error !== null
    && typeof error === 'object'
    && 'name' in error
    && error.name === 'AbortError'
}

export function createIslandRuntime(
  islandModules: IslandClientModules,
  options: CreateIslandRuntimeOptions = {},
): IslandRuntime {
  const loaders = new Map<string, () => Promise<IslandModule>>()
  for (const [file, load] of Object.entries(islandModules)) {
    const id = islandFileToId(file)
    if (loaders.has(id)) throw new Error(`Duplicate island ID: ${id}`)
    loaders.set(id, memoizeLoader(load))
  }
  const mounted = new Map<HTMLElement, MountedIsland>()
  const loadHydrator = lazyHydrator(options.hydrateRoot)
  const reportError = options.reportError ?? defaultReportError
  let destroyed = false

  function cleanup(element: HTMLElement, state: MountedIsland) {
    if (!state.active) return
    state.active = false
    state.scheduled?.cancel()
    state.controller.abort()
    mounted.delete(element)
    const reactRoot = state.reactRoot
    delete state.reactRoot
    reactRoot?.unmount()
  }

  function cleanupAll(entries: readonly [HTMLElement, MountedIsland][]) {
    const failures: unknown[] = []
    for (const [element, state] of entries) {
      try {
        cleanup(element, state)
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, 'Nib island cleanup failed')
    }
  }

  return {
    mount(root = document) {
      if (destroyed) throw new Error('Cannot mount a destroyed Nib island runtime')
      for (const element of elementsWithin(root)) {
        if (mounted.has(element)) continue
        const id = element.dataset.nibIsland
        const instance = element.dataset.nibInstance
        const strategy = element.dataset.nibWhen
        if (!isIslandHydrationStrategy(strategy)) {
          reportError(
            id ?? 'unknown',
            instance ?? 'unknown',
            new Error(`Invalid island hydration strategy: ${String(strategy)}`),
          )
          continue
        }
        if (
          !id
          || !instance
          || !element.dataset.nibPrefix
          || element.dataset.nibProps === undefined
        ) {
          reportError(
            id ?? 'unknown',
            instance ?? 'unknown',
            new Error('Island element is missing hydration metadata'),
          )
          continue
        }
        if (!loaders.has(id)) {
          reportError(
            id,
            instance,
            new Error(`No client module found for island ${id}`),
          )
          continue
        }
        const state: MountedIsland = {
          active: true,
          controller: new AbortController(),
        }
        mounted.set(element, state)
        state.scheduled = scheduleIslandHydration(element, strategy, () => {
          if (!state.active) return
          if (!rootContains(root, element)) {
            cleanup(element, state)
            return
          }
          void loadHydrator().then(({ hydrateIsland, hydrateRoot }) => (
            hydrateIsland(element, {
              loaders,
              hydrateRoot,
              reportError,
              signal: state.controller.signal,
              shouldHydrate: () => state.active && rootContains(root, element),
            })
          )).then((reactRoot) => {
            if (!state.active || !rootContains(root, element)) {
              reactRoot.unmount()
              return
            }
            state.reactRoot = reactRoot
          }).catch((error: unknown) => {
            if (!state.active) return
            cleanup(element, state)
            if (!isAbortError(error)) reportError(id, instance, error)
          })
        }, options.environment)
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      cleanupAll([...mounted])
    },
  }
}
