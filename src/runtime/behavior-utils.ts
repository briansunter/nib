/**
 * Signal-bound client lifecycle utilities.
 *
 * Each helper takes a behavior's AbortSignal and self-registers its cleanup on
 * abort, so authors stop threading `{ signal }` into every listener and writing
 * manual `signal.addEventListener('abort', ...)` teardown.
 */

export type UrlUpdateMode = 'replace' | 'push'

/** addEventListener with the signal always bound (forwards passive/capture/once). No-ops on a null target, matching `el?.addEventListener`. Pass an explicit type argument for typed event properties, e.g. `on<KeyboardEvent>(document, 'keydown', (e) => e.key, signal)`. */
export function on<T extends Event = Event>(
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
  on(
    window,
    'scroll',
    () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        handler()
        ticking = false
      })
    },
    signal,
    { passive: true },
  )
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
  const existing = root.querySelector<T>(selector)
  if (existing) return Promise.resolve(existing)

  return new Promise<T>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const element = root.querySelector<T>(selector)
      if (!element) return
      observer.disconnect()
      resolve(element)
    })
    observer.observe(root, { childList: true, subtree: true })
    signal.addEventListener(
      'abort',
      () => {
        observer.disconnect()
        reject(signal.reason ?? new Error('waitForElement aborted'))
      },
      { once: true },
    )
  })
}

/** Merge only owned search params, preserving unrelated params, hash, and history state. */
export function setParams(
  updater: (params: URLSearchParams) => void,
  mode: UrlUpdateMode = 'replace',
): void {
  const url = new URL(window.location.href)
  updater(url.searchParams)
  window.history[mode === 'push' ? 'pushState' : 'replaceState'](
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  )
}

/** Splits / trims / lowercases / dedupes a data-attribute tag string. */
export function splitTags(value: string, separator = ','): string[] {
  return [
    ...new Set(
      value
        .split(separator)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
}

export interface ReflectButtonOptions {
  /** Active class to toggle. Default 'is-selected'; pass null to skip the class toggle. */
  readonly class?: string | null
  /** Extra class toggled alongside the active class. */
  readonly extraClass?: string
  /** Attribute set when active and removed when inactive (e.g. 'data-active'). */
  readonly attribute?: string
}

/** Reflect a boolean onto a button: aria-pressed + class (and optional attribute). */
export function reflectButtonGroup(
  button: HTMLElement,
  active: boolean,
  options: ReflectButtonOptions = {},
): void {
  button.setAttribute('aria-pressed', String(active))
  const className = options.class === undefined ? 'is-selected' : options.class
  if (className !== null) button.classList.toggle(className, active)
  if (options.extraClass) button.classList.toggle(options.extraClass, active)
  if (options.attribute) {
    if (active) button.setAttribute(options.attribute, '')
    else button.removeAttribute(options.attribute)
  }
}

export interface LoadScriptOptions {
  readonly signal: AbortSignal
  /** Full attribute name (e.g. 'data-pagefind') set on the script for dedupe selectors. */
  readonly dataAttr?: string
  /** Load as an ES module. */
  readonly module?: boolean
}

const scriptLoaders = new Map<string, Promise<void>>()

/** Lazily load a third-party script, deduping concurrent loads for the same src. */
export function loadScript(src: string, options: LoadScriptOptions): Promise<void> {
  if (options.signal.aborted) {
    return Promise.reject(options.signal.reason ?? new Error('loadScript aborted'))
  }
  const cached = scriptLoaders.get(src)
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    if (options.module) script.type = 'module'
    script.src = src
    script.async = true
    if (options.dataAttr) script.setAttribute(options.dataAttr, '')
    document.head.append(script)

    const finish = (outcome: () => void): void => {
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
      options.signal.removeEventListener('abort', onAbort)
      scriptLoaders.delete(src)
      outcome()
    }
    const onLoad = (): void => finish(resolve)
    const onError = (): void => finish(() => reject(new Error(`Failed to load script: ${src}`)))
    const onAbort = (): void =>
      finish(() => reject(options.signal.reason ?? new Error('loadScript aborted')))

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    options.signal.addEventListener('abort', onAbort, { once: true })
  })

  scriptLoaders.set(src, promise)
  return promise
}
