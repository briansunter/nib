import { behaviorFileToId } from '../framework/behavior-paths'
import type { ClientMountStrategy } from '../framework/hydration'
import {
  scheduleClientMount,
  type ClientMountEnvironment,
  type ScheduledClientMount,
} from '../framework/client-mount-scheduler'

export interface BehaviorContext {
  root: HTMLElement
  signal: AbortSignal
}

export type ClientBehavior = (
  context: BehaviorContext,
) => void | Promise<void>

export interface BehaviorClientModule {
  default: unknown
}

export type BehaviorClientModules = Record<string, () => Promise<BehaviorClientModule>>

export interface BehaviorRuntime {
  mount(root?: ParentNode): void
  unmount(root?: ParentNode): void
  destroy(): void
}

export interface CreateBehaviorRuntimeOptions {
  environment?: ClientMountEnvironment
  reportError?: (id: string, error: unknown) => void
}

interface MountedBehavior {
  active: boolean
  owner: ParentNode
  controller: AbortController
  scheduled?: ScheduledClientMount
}

function validateBehaviorModule(
  file: string,
  module: BehaviorClientModule,
): ClientBehavior {
  if (typeof module.default !== 'function') {
    throw new Error(
      `Behavior module ${file} must default-export a behavior mount function`,
    )
  }
  return module.default as ClientBehavior
}

function elementsWithin(root: ParentNode): HTMLElement[] {
  const elements = [...root.querySelectorAll<HTMLElement>('[data-nib-behavior]')]
  if (
    typeof HTMLElement !== 'undefined'
    && root instanceof HTMLElement
    && root.matches('[data-nib-behavior]')
  ) {
    elements.unshift(root)
  }
  return [...new Set(elements)]
}

function rootContains(root: ParentNode, element: HTMLElement): boolean {
  return typeof root.contains !== 'function' || root.contains(element)
}

function defaultReportError(id: string, error: unknown) {
  console.error(`Failed to mount behavior ${id}`, error)
}

export function createBehaviorRuntime(
  modules: BehaviorClientModules,
  options: CreateBehaviorRuntimeOptions = {},
): BehaviorRuntime {
  const loaders = new Map<string, () => Promise<ClientBehavior>>()
  for (const [file, loadModule] of Object.entries(modules)) {
    const id = behaviorFileToId(file)
    if (loaders.has(id)) throw new Error(`Duplicate behavior ID: ${id}`)
    let loaded: Promise<ClientBehavior> | undefined
    loaders.set(id, () => {
      if (loaded !== undefined) return loaded
      loaded = loadModule()
        .then((module) => validateBehaviorModule(file, module))
        .catch((error: unknown) => {
          loaded = undefined
          throw error
        })
      return loaded
    })
  }
  const mounted = new Map<HTMLElement, MountedBehavior>()
  const reportError = options.reportError ?? defaultReportError
  let destroyed = false

  function cleanup(element: HTMLElement, state: MountedBehavior) {
    if (!state.active) return
    state.active = false
    state.scheduled?.cancel()
    delete element.dataset.scheduled
    mounted.delete(element)
    state.controller.abort()
  }

  function cleanupAll(entries: readonly [HTMLElement, MountedBehavior][]) {
    const failures: unknown[] = []
    for (const [element, state] of entries) {
      try {
        cleanup(element, state)
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, 'Nib behavior cleanup failed')
    }
  }

  const runtime: BehaviorRuntime = {
    mount(root = document) {
      if (destroyed) throw new Error('Cannot mount a destroyed Nib behavior runtime')
      for (const element of elementsWithin(root)) {
        if (mounted.has(element)) continue
        const id = element.dataset.nibBehavior
        const rawStrategy = element.dataset.nibDefer
        let strategy: ClientMountStrategy | undefined
        if (id === undefined) {
          reportError('unknown', new Error(`Invalid behavior mount metadata`))
          continue
        }
        if (rawStrategy === undefined) {
          strategy = undefined
        } else if (rawStrategy === 'idle' || rawStrategy === 'visible') {
          strategy = rawStrategy as ClientMountStrategy
        } else {
          reportError(id, new Error(`Invalid behavior defer metadata`))
          continue
        }
        const load = loaders.get(id)
        if (!load) {
          reportError(id, new Error(`No client module found for behavior ${id}`))
          continue
        }
        const state: MountedBehavior = {
          active: true,
          owner: root,
          controller: new AbortController(),
        }
        mounted.set(element, state)
        element.dataset.scheduled = 'true'
        const runMount = () => {
          if (!state.active) return
          if (!rootContains(root, element)) {
            cleanup(element, state)
            return
          }
          void load().then(async (mountBehavior) => {
            if (!state.active) return
            if (!rootContains(root, element)) {
              cleanup(element, state)
              return
            }
            await mountBehavior({
              root: element,
              signal: state.controller.signal,
            })
            if (!state.active || !rootContains(root, element)) {
              if (state.active) cleanup(element, state)
            }
          }).catch((error) => {
            if (!state.active) return
            cleanup(element, state)
            reportError(id, error)
          })
        }
        if (strategy === undefined) {
          runMount()
        } else {
          state.scheduled = scheduleClientMount(element, strategy, runMount, options.environment)
        }
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
