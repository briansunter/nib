import { hydrateRoot } from 'react-dom/client'
import { islandFileToId } from '../framework/island-paths'
import {
  hydrateIsland,
  scheduleHydration,
  type IslandHydrateRoot,
  type IslandHydrationEnvironment,
  type IslandReactRoot,
  type ScheduledHydration,
} from '../framework/island-runtime'
import type { HydrationStrategy, IslandModule } from '../framework/islands'

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
  owner: ParentNode
  scheduled?: ScheduledHydration
  reactRoot?: IslandReactRoot
}

function isHydrationStrategy(value: string | undefined): value is HydrationStrategy {
  return value === 'load' || value === 'idle' || value === 'visible'
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

export function createIslandRuntime(
  islandModules: IslandClientModules,
  options: CreateIslandRuntimeOptions = {},
): IslandRuntime {
  const loaders = new Map<string, () => Promise<IslandModule>>()
  for (const [file, load] of Object.entries(islandModules)) {
    const id = islandFileToId(file)
    if (loaders.has(id)) throw new Error(`Duplicate island ID: ${id}`)
    loaders.set(id, load)
  }
  const mounted = new Map<HTMLElement, MountedIsland>()
  const hydrate = options.hydrateRoot ?? hydrateRoot
  const reportError = options.reportError ?? defaultReportError
  let destroyed = false

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
        const state: MountedIsland = { active: true, owner: root }
        mounted.set(element, state)
        element.dataset.scheduled = 'true'
        state.scheduled = scheduleHydration(element, strategy, () => {
          if (!state.active || !rootContains(root, element)) return
          void hydrateIsland(element, {
            loaders,
            hydrateRoot: hydrate,
            reportError,
          }).then((reactRoot) => {
            if (!state.active || !rootContains(root, element)) {
              reactRoot.unmount()
              return
            }
            state.reactRoot = reactRoot
          }).catch((error) => {
            if (!state.active) return
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
      for (const [element, state] of mounted) {
        if (state.owner !== root && rootContains(root, element) === false) continue
        state.active = false
        state.scheduled?.cancel()
        state.reactRoot?.unmount()
        delete element.dataset.scheduled
        mounted.delete(element)
      }
    },
    destroy() {
      if (destroyed) return
      for (const [element, state] of mounted) {
        state.active = false
        state.scheduled?.cancel()
        state.reactRoot?.unmount()
        delete element.dataset.scheduled
      }
      mounted.clear()
      destroyed = true
    },
  }
  return runtime
}

/** Mounts the legacy document-wide runtime and returns its public controller. */
export function startIslandRuntime(
  islandModules: IslandClientModules,
  documentRoot: Document = document,
): IslandRuntime {
  const runtime = createIslandRuntime(islandModules)
  runtime.mount(documentRoot)
  return runtime
}
