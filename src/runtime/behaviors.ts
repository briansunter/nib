import { behaviorFileToId } from '../framework/behavior-paths'

/** One browser enhancement attached to one server-rendered element. */
export type ClientBehavior = (
  root: HTMLElement,
  signal: AbortSignal,
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

interface BehaviorRuntimeEnvironment {
  requestIdleCallback?: (callback: () => void) => number
  cancelIdleCallback?: (handle: number) => void
  setTimeout: (callback: () => void, delay: number) => number
  clearTimeout?: (handle: number) => void
  IntersectionObserver?: typeof window.IntersectionObserver
}

export interface CreateBehaviorRuntimeOptions {
  environment?: BehaviorRuntimeEnvironment
  reportError?: (id: string, error: unknown) => void
}

interface MountedBehavior {
  owner: ParentNode
  controller: AbortController
  cancel?: () => void
}

function validateBehaviorModule(
  file: string,
  module: BehaviorClientModule,
): ClientBehavior {
  if (typeof module.default !== 'function') {
    throw new Error(
      `Behavior module ${file} must default-export a behavior function`,
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

function contains(parent: HTMLElement, child: HTMLElement): boolean {
  return typeof parent.contains === 'function' && parent.contains(child)
}

function deepestFirst(
  entries: readonly [HTMLElement, MountedBehavior][],
): [HTMLElement, MountedBehavior][] {
  const depth = new Map(entries.map(([element]) => [
    element,
    entries.filter(([ancestor]) => (
      ancestor !== element && contains(ancestor, element)
    )).length,
  ]))
  return [...entries].sort(([left], [right]) => (
    depth.get(right)! - depth.get(left)!
  ))
}

function defaultReportError(id: string, error: unknown) {
  console.error(`Failed to mount behavior ${id}`, error)
}

function schedule(
  element: HTMLElement,
  defer: 'idle' | 'visible',
  mount: () => void,
  environment: BehaviorRuntimeEnvironment = window,
): () => void {
  let finished = false
  let cancelPending = () => {}
  const runOnce = () => {
    if (finished) return
    finished = true
    cancelPending()
    mount()
  }
  const cancel = () => {
    if (finished) return
    finished = true
    cancelPending()
  }

  if (defer === 'idle') {
    if (typeof environment.requestIdleCallback === 'function') {
      const handle = environment.requestIdleCallback(runOnce)
      cancelPending = () => environment.cancelIdleCallback?.(handle)
    } else {
      const handle = environment.setTimeout(runOnce, 1)
      cancelPending = () => environment.clearTimeout?.(handle)
    }
    return cancel
  }

  if (environment.IntersectionObserver === undefined) {
    runOnce()
    return cancel
  }
  const observer = new environment.IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) runOnce()
  }, { rootMargin: '200px' })
  cancelPending = () => observer.disconnect()
  observer.observe(element)
  return cancel
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
      loaded = Promise.resolve()
        .then(loadModule)
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
    if (state.controller.signal.aborted) return
    state.cancel?.()
    mounted.delete(element)
    state.controller.abort()
  }

  function cleanupAll(entries: readonly [HTMLElement, MountedBehavior][]) {
    const failures: unknown[] = []
    for (const [element, state] of deepestFirst(entries)) {
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

  return {
    mount(root = document) {
      if (destroyed) throw new Error('Cannot mount a destroyed Nib behavior runtime')
      for (const element of elementsWithin(root)) {
        if (mounted.has(element)) continue
        const id = element.dataset.nibBehavior
        if (
          typeof HTMLElement !== 'undefined'
          && !(element instanceof HTMLElement)
        ) {
          reportError(
            id ?? 'unknown',
            new Error('Behavior roots must be HTML elements'),
          )
          continue
        }
        const rawDefer = element.dataset.nibDefer
        if (id === undefined) {
          reportError('unknown', new Error('Invalid behavior mount metadata'))
          continue
        }
        if (rawDefer !== undefined && rawDefer !== 'idle' && rawDefer !== 'visible') {
          reportError(id, new Error('Invalid behavior defer metadata'))
          continue
        }
        const load = loaders.get(id)
        if (load === undefined) {
          reportError(id, new Error(`No client module found for behavior ${id}`))
          continue
        }
        const state: MountedBehavior = {
          owner: root,
          controller: new AbortController(),
        }
        mounted.set(element, state)
        const runMount = () => {
          if (state.controller.signal.aborted) return
          if (!rootContains(root, element)) {
            cleanup(element, state)
            return
          }
          void load().then(async (behavior) => {
            if (state.controller.signal.aborted) return
            if (!rootContains(root, element)) {
              cleanup(element, state)
              return
            }
            await behavior(element, state.controller.signal)
            if (!state.controller.signal.aborted && !rootContains(root, element)) {
              cleanup(element, state)
            }
          }).catch((error) => {
            if (state.controller.signal.aborted) return
            cleanup(element, state)
            reportError(id, error)
          })
        }
        if (rawDefer === undefined) runMount()
        else state.cancel = schedule(element, rawDefer, runMount, options.environment)
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
}
