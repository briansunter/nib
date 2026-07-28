import { isHydrationStrategy } from '../framework/hydration'
import {
  scheduleHydration,
  type ScheduledHydration,
} from '../framework/hydration-scheduler'
import { islandFileToId } from '../framework/island-paths'
import type {
  IslandHydrateRoot,
  IslandHydrationEnvironment,
  IslandReactRoot,
} from '../framework/island-runtime'
import type { IslandModule } from '../framework/islands'

export type IslandClientModules = Record<string, () => Promise<IslandModule>>

export interface IslandRuntime {
  mount(root?: ParentNode): void
  unmount(root?: ParentNode): void
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
  owner: ParentNode
  scheduled?: ScheduledHydration
  reactRoot?: IslandReactRoot
}

function defaultReportError(id: string, instance: string, error: unknown) {
  console.error(`Failed to hydrate island ${id} (${instance})`, error)
}

function elementsWithin(root: ParentNode): HTMLElement[] {
  const elements = [...root.querySelectorAll<HTMLElement>('nib-island[data-island]')]
  if (
    typeof HTMLElement !== 'undefined'
    && root instanceof HTMLElement
    && root.matches('nib-island[data-island]')
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
      injectedHydrateRoot
        ? Promise.resolve(injectedHydrateRoot)
        : import('react-dom/client').then((module) => module.hydrateRoot),
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
    delete element.dataset.scheduled
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

  const runtime: IslandRuntime = {
    mount(root = document) {
      if (destroyed) throw new Error('Cannot mount a destroyed Nib island runtime')
      for (const element of elementsWithin(root)) {
        if (mounted.has(element)) continue
        const strategy = element.dataset.hydrate
        if (!isHydrationStrategy(strategy)) {
          reportError(
            element.dataset.island ?? 'unknown',
            element.dataset.instance ?? 'unknown',
            new Error(`Invalid hydration strategy: ${String(strategy)}`),
          )
          continue
        }
        const id = element.dataset.island
        const instance = element.dataset.instance
        if (
          !id
          || !instance
          || !element.dataset.prefix
          || element.dataset.props === undefined
        ) {
          reportError(
            id ?? 'unknown',
            instance ?? 'unknown',
            new Error('Island element is missing hydration metadata'),
          )
          continue
        }
        const loadIsland = loaders.get(id)
        if (!loadIsland) {
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
          owner: root,
        }
        mounted.set(element, state)
        element.dataset.scheduled = 'true'
        state.scheduled = scheduleHydration(element, strategy, () => {
          if (!state.active) return
          if (!rootContains(root, element)) {
            cleanup(element, state)
            return
          }
          void Promise.all([
            loadHydrator(),
            loadIsland(),
          ]).then(([{ hydrateIsland, hydrateRoot }]) => {
            if (!state.active) return
            if (!rootContains(root, element)) {
              cleanup(element, state)
              return
            }
            return hydrateIsland(element, {
              loaders,
              hydrateRoot,
              reportError,
              signal: state.controller.signal,
              shouldHydrate: () => (
                state.active && rootContains(root, element)
              ),
            })
          }).then((reactRoot) => {
            if (!reactRoot) return
            if (!state.active || !rootContains(root, element)) {
              try {
                reactRoot.unmount()
              } catch (error) {
                reportError(
                  element.dataset.island ?? 'unknown',
                  element.dataset.instance ?? 'unknown',
                  error,
                )
              }
              return
            }
            state.reactRoot = reactRoot
          }).catch((error) => {
            if (!state.active) return
            cleanup(element, state)
            if (isAbortError(error)) return
            reportError(
              element.dataset.island ?? 'unknown',
              element.dataset.instance ?? 'unknown',
              error,
            )
          })
        }, options.environment)
      }
    },
    unmount(root = document) {
      cleanupAll([...mounted].filter(([element, state]) => (
        state.owner === root || rootContains(root, element)
      )))
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      cleanupAll([...mounted])
    },
  }
  return runtime
}
