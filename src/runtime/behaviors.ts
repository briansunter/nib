import { behaviorFileToId } from '../framework/behavior-paths'
import { isHydrationStrategy } from '../framework/hydration'
import {
  scheduleHydration,
  type HydrationEnvironment,
  type ScheduledHydration,
} from '../framework/hydration-scheduler'
import { parseIslandProps } from '../framework/island-serialization'

const BEHAVIOR_CLIENT_DEFINITION = Symbol.for('nib.behavior-client-definition')

export interface BehaviorMountContext<Props extends object = Record<string, unknown>> {
  root: HTMLElement
  props: Props
  signal: AbortSignal
}

export type BehaviorCleanup = void | (() => void)
export type BehaviorMount<Props extends object = Record<string, unknown>> = (
  context: BehaviorMountContext<Props>,
) => BehaviorCleanup | Promise<BehaviorCleanup>

export interface BehaviorClientDefinition<Props extends object = Record<string, unknown>> {
  readonly [BEHAVIOR_CLIENT_DEFINITION]: true
  readonly mount: BehaviorMount<Props>
}

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
  environment?: HydrationEnvironment
  reportError?: (id: string, error: unknown) => void
}

interface MountedBehavior {
  active: boolean
  owner: ParentNode
  controller: AbortController
  scheduled?: ScheduledHydration
  cleanup?: () => void
}

export function defineBehaviorClient<Props extends object = Record<string, unknown>>(
  mount: BehaviorMount<Props>,
): BehaviorClientDefinition<Props> {
  if (typeof mount !== 'function') throw new Error('Client behavior mount must be a function')
  return Object.freeze({
    [BEHAVIOR_CLIENT_DEFINITION]: true as const,
    mount,
  })
}

function validateBehaviorModule(
  file: string,
  module: BehaviorClientModule,
): BehaviorClientDefinition {
  const definition = module.default as Partial<BehaviorClientDefinition> | undefined
  if (
    definition?.[BEHAVIOR_CLIENT_DEFINITION] !== true
    || typeof definition.mount !== 'function'
  ) {
    throw new Error(`Behavior module ${file} must default-export defineBehaviorClient(...)`)
  }
  return definition as BehaviorClientDefinition
}

function elementsWithin(root: ParentNode): HTMLElement[] {
  const elements = [...root.querySelectorAll<HTMLElement>('nib-behavior[data-behavior]')]
  if (
    typeof HTMLElement !== 'undefined'
    && root instanceof HTMLElement
    && root.matches('nib-behavior[data-behavior]')
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
  const loaders = new Map<string, () => Promise<BehaviorClientDefinition>>()
  for (const [file, loadModule] of Object.entries(modules)) {
    const id = behaviorFileToId(file)
    if (loaders.has(id)) throw new Error(`Duplicate behavior ID: ${id}`)
    let loaded: Promise<BehaviorClientDefinition> | undefined
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
    state.controller.abort()
    delete element.dataset.scheduled
    mounted.delete(element)
    const applicationCleanup = state.cleanup
    delete state.cleanup
    applicationCleanup?.()
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
        const id = element.dataset.behavior
        const strategy = element.dataset.hydrate
        if (!id || !isHydrationStrategy(strategy)) {
          reportError(id ?? 'unknown', new Error(`Invalid behavior hydration metadata`))
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
        state.scheduled = scheduleHydration(element, strategy, () => {
          if (!state.active) return
          if (!rootContains(root, element)) {
            cleanup(element, state)
            return
          }
          void load().then(async (definition) => {
            if (!state.active) return
            if (!rootContains(root, element)) {
              cleanup(element, state)
              return
            }
            const result = await definition.mount({
              root: element,
              props: parseIslandProps(element.dataset.props ?? ''),
              signal: state.controller.signal,
            })
            if (!state.active || !rootContains(root, element)) {
              if (state.active) cleanup(element, state)
              if (typeof result === 'function') {
                try {
                  result()
                } catch (error) {
                  reportError(id, error)
                }
              }
              return
            }
            if (typeof result === 'function') state.cleanup = result
          }).catch((error) => {
            if (!state.active) return
            cleanup(element, state)
            reportError(id, error)
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
