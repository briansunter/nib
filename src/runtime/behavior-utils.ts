/**
 * Signal-bound client lifecycle utilities.
 *
 * Each helper takes a behavior's AbortSignal and self-registers its cleanup on
 * abort, so authors stop threading `{ signal }` into every listener and writing
 * manual `signal.addEventListener('abort', ...)` teardown.
 */

/** Internal addEventListener helper used by lifecycle primitives. */
function on<T extends Event = Event>(
  target: EventTarget | null,
  type: string,
  handler: (event: T) => void,
  signal: AbortSignal,
  options: AddEventListenerOptions = {},
): void {
  if (target === null) return
  target.addEventListener(type, handler as EventListener, { ...options, signal })
}

/** A passive, rAF-throttled scroll listener that cleans up on abort. */
export function onScroll(handler: () => void, signal: AbortSignal): void {
  let ticking = false
  let frame: number | undefined
  const cancelFrame = (): void => {
    if (frame === undefined) return
    window.cancelAnimationFrame(frame)
    frame = undefined
    ticking = false
  }
  on(
    window,
    'scroll',
    () => {
      if (ticking) return
      ticking = true
      frame = window.requestAnimationFrame(() => {
        frame = undefined
        if (signal.aborted) {
          ticking = false
          return
        }
        handler()
        ticking = false
      })
    },
    signal,
    { passive: true },
  )
  signal.addEventListener('abort', cancelFrame, { once: true })
}

/** A debounced call whose pending timer is cleared on abort. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
  signal: AbortSignal,
): (...args: A) => void {
  let timer: number | undefined
  const trigger = (...args: A): void => {
    if (signal.aborted) return
    window.clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), ms)
  }
  signal.addEventListener('abort', () => window.clearTimeout(timer), { once: true })
  return trigger
}

/** A one-shot timer that auto-cancels on abort; returns a cancel function. */
export function later(fn: () => void, ms: number, signal: AbortSignal): () => void {
  if (signal.aborted) return () => {}
  const timer = window.setTimeout(fn, ms)
  const cancel = (): void => window.clearTimeout(timer)
  signal.addEventListener('abort', cancel, { once: true })
  return cancel
}

/** A MutationObserver that disconnects on abort. */
export function observeMutations(
  target: Node,
  callback: MutationCallback,
  options: MutationObserverInit,
  signal: AbortSignal,
): MutationObserver {
  const observer = new MutationObserver(callback)
  observer.observe(target, options)
  signal.addEventListener('abort', () => observer.disconnect(), { once: true })
  return observer
}

/** An IntersectionObserver that disconnects on abort. */
export function observeIntersections(
  target: Element | readonly Element[],
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit,
  signal: AbortSignal,
): IntersectionObserver {
  const observer = new IntersectionObserver(callback, options)
  const targets = Array.isArray(target) ? target : [target]
  for (const element of targets) observer.observe(element)
  signal.addEventListener('abort', () => observer.disconnect(), { once: true })
  return observer
}

/**
 * Resolves an element matching the selector, observing for its insertion if it
 * is not present yet. Rejects on abort. Replaces retry-counter polling.
 */
export function waitForElement<T extends Element = Element>(
  root: ParentNode,
  selector: string,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error('waitForElement aborted'))
  }
  const existing = root.querySelector<T>(selector)
  if (existing) return Promise.resolve(existing)

  return new Promise<T>((resolve, reject) => {
    let settled = false
    const cleanup = (): void => {
      observer.disconnect()
      signal.removeEventListener('abort', onAbort)
    }
    const onAbort = (): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(signal.reason ?? new Error('waitForElement aborted'))
    }
    const observer = new MutationObserver(() => {
      const element = root.querySelector<T>(selector)
      if (!element) return
      if (settled) return
      settled = true
      cleanup()
      resolve(element)
    })
    observer.observe(root, { childList: true, subtree: true })
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export interface LoadScriptOptions {
  readonly signal: AbortSignal
  /** Full attribute name (e.g. 'data-pagefind') set on the script for dedupe selectors. */
  readonly dataAttr?: string
  /** Load as an ES module. */
  readonly module?: boolean
}

const scriptLoaders = new Map<string, Promise<void>>()

function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error('loadScript aborted'))
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      cleanup()
      reject(signal.reason ?? new Error('loadScript aborted'))
    }
    const cleanup = (): void => signal.removeEventListener('abort', onAbort)
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error: unknown) => {
        cleanup()
        reject(error)
      },
    )
  })
}

function createScriptLoad(src: string, options: Omit<LoadScriptOptions, 'signal'>): Promise<void> {
  const absoluteSrc = new URL(src, document.baseURI).href
  const existing = [...document.scripts].find((script) => (
    script.src === absoluteSrc || script.getAttribute('src') === src
  ))
  if (existing) {
    if (existing.dataset.nibLoaded === 'true') return Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement('script')
    if (!existing) {
      if (options.module) script.type = 'module'
      script.src = src
      script.async = true
      if (options.dataAttr) script.setAttribute(options.dataAttr, '')
      document.head.append(script)
    }
    const onLoad = (): void => {
      script.dataset.nibLoaded = 'true'
      cleanup()
      resolve()
    }
    const onError = (): void => {
      cleanup()
      scriptLoaders.delete(src)
      reject(new Error(`Failed to load script: ${src}`))
    }
    const cleanup = (): void => {
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
  })
}

/** Lazily load a third-party script, deduping concurrent loads for the same src. */
export function loadScript(src: string, options: LoadScriptOptions): Promise<void> {
  let shared = scriptLoaders.get(src)
  if (shared === undefined) {
    shared = createScriptLoad(src, options)
    scriptLoaders.set(src, shared)
  }
  return raceWithAbort(shared, options.signal)
}
