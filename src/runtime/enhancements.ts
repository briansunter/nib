import { enhancementFileToId } from '../framework/enhancement-paths'

/** One browser enhancement attached to one server-rendered element. */
export type ClientEnhancement = (
  root: HTMLElement,
  signal: AbortSignal,
) => void | Promise<void>

export interface EnhancementClientModule {
  default: unknown
}

export type EnhancementClientModules = Record<
  string,
  () => Promise<EnhancementClientModule>
>

export interface EnhancementRuntime {
  mount(root?: ParentNode): void
  destroy(): void
}

interface EnhancementRuntimeEnvironment {
  IntersectionObserver?: typeof window.IntersectionObserver
}

export interface CreateEnhancementRuntimeOptions {
  environment?: EnhancementRuntimeEnvironment
  reportError?: (id: string, error: unknown) => void
}

interface MountedEnhancement {
  controller: AbortController
  cancel?: () => void
}

function validateEnhancementModule(
  file: string,
  module: EnhancementClientModule,
): ClientEnhancement {
  if (typeof module.default !== 'function') {
    throw new Error(
      `Enhancement module ${file} must default-export an enhancement function`,
    )
  }
  return module.default as ClientEnhancement
}

function elementsWithin(root: ParentNode): HTMLElement[] {
  const elements = [
    ...root.querySelectorAll<HTMLElement>('[data-nib-enhancement]'),
  ]
  if (
    typeof HTMLElement !== 'undefined'
    && root instanceof HTMLElement
    && root.matches('[data-nib-enhancement]')
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
  entries: readonly [HTMLElement, MountedEnhancement][],
): [HTMLElement, MountedEnhancement][] {
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
  console.error(`Failed to mount enhancement ${id}`, error)
}

function scheduleVisible(
  element: HTMLElement,
  mount: () => void,
  environment: EnhancementRuntimeEnvironment = window,
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

export function createEnhancementRuntime(
  modules: EnhancementClientModules,
  options: CreateEnhancementRuntimeOptions = {},
): EnhancementRuntime {
  const loaders = new Map<string, () => Promise<ClientEnhancement>>()
  for (const [file, loadModule] of Object.entries(modules)) {
    const id = enhancementFileToId(file)
    if (loaders.has(id)) throw new Error(`Duplicate enhancement ID: ${id}`)
    let loaded: Promise<ClientEnhancement> | undefined
    loaders.set(id, () => {
      if (loaded !== undefined) return loaded
      loaded = Promise.resolve()
        .then(loadModule)
        .then((module) => validateEnhancementModule(file, module))
        .catch((error: unknown) => {
          loaded = undefined
          throw error
        })
      return loaded
    })
  }
  const mounted = new Map<HTMLElement, MountedEnhancement>()
  const reportError = options.reportError ?? defaultReportError
  let destroyed = false

  function cleanup(element: HTMLElement, state: MountedEnhancement) {
    if (state.controller.signal.aborted) return
    state.cancel?.()
    mounted.delete(element)
    state.controller.abort()
  }

  function cleanupAll(entries: readonly [HTMLElement, MountedEnhancement][]) {
    const failures: unknown[] = []
    for (const [element, state] of deepestFirst(entries)) {
      try {
        cleanup(element, state)
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, 'Nib enhancement cleanup failed')
    }
  }

  return {
    mount(root = document) {
      if (destroyed) throw new Error('Cannot mount a destroyed Nib enhancement runtime')
      for (const element of elementsWithin(root)) {
        if (mounted.has(element)) continue
        const id = element.dataset.nibEnhancement
        if (
          typeof HTMLElement !== 'undefined'
          && !(element instanceof HTMLElement)
        ) {
          reportError(
            id ?? 'unknown',
            new Error('Enhancement roots must be HTML elements'),
          )
          continue
        }
        const rawWhen = element.dataset.nibWhen
        if (id === undefined) {
          reportError('unknown', new Error('Invalid enhancement mount metadata'))
          continue
        }
        if (rawWhen !== undefined && rawWhen !== 'visible') {
          reportError(id, new Error('Invalid enhancement timing metadata'))
          continue
        }
        const load = loaders.get(id)
        if (load === undefined) {
          reportError(id, new Error(`No client module found for enhancement ${id}`))
          continue
        }
        const state: MountedEnhancement = {
          controller: new AbortController(),
        }
        mounted.set(element, state)
        const runMount = () => {
          if (state.controller.signal.aborted) return
          if (!rootContains(root, element)) {
            cleanup(element, state)
            return
          }
          void load().then(async (enhancement) => {
            if (state.controller.signal.aborted) return
            if (!rootContains(root, element)) {
              cleanup(element, state)
              return
            }
            await enhancement(element, state.controller.signal)
            if (!state.controller.signal.aborted && !rootContains(root, element)) {
              cleanup(element, state)
            }
          }).catch((error) => {
            if (state.controller.signal.aborted) return
            cleanup(element, state)
            reportError(id, error)
          })
        }
        if (rawWhen === undefined) runMount()
        else state.cancel = scheduleVisible(element, runMount, options.environment)
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      cleanupAll([...mounted])
    },
  }
}
