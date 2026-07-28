import {
  mountClientRuntimes,
  unmountClientRuntimes,
} from './runtime/coordinator'
import {
  HISTORY_INDEX,
  HISTORY_SCROLL_X,
  HISTORY_SCROLL_Y,
  navigationState,
  replaceHistoryScroll,
  stateNumber,
} from './navigation/history'
import {
  connectionIsSlow,
  NavigationPageCache,
  requestPage,
} from './navigation/page-cache'
import type {
  ClientNavigationController,
  NavigateOptions,
  NavigationBeforeSwapDetail,
  NavigationContext,
  NavigationDirection,
  NavigationHistoryState,
  NavigationLifecycleDetail,
  NavigationType,
} from './navigation/types'
export type {
  ClientNavigationController,
  NavigateOptions,
  NavigationBeforeSwapDetail,
  NavigationDirection,
  NavigationLifecycleDetail,
  NavigationType,
} from './navigation/types'

const HOVER_PREFETCH_DELAY_MS = 80
const PERSIST_ATTRIBUTE = 'data-nib-navigation-persist'
const EXECUTED_SCRIPT_ATTRIBUTE = 'data-nib-script-executed'
const RERUN_SCRIPT_ATTRIBUTE = 'data-nib-script-rerun'

function elementHref(element: Element): string | null {
  if (
    element instanceof HTMLAnchorElement
    || element instanceof HTMLAreaElement
  ) {
    return element.href || null
  }
  if (element instanceof SVGAElement) {
    return element.href.baseVal || null
  }
  return null
}

function linkFromEvent(event: Event): Element | null {
  const pathTarget = typeof event.composedPath === 'function'
    ? event.composedPath()[0]
    : event.target
  if (!(pathTarget instanceof Element)) return null
  const link = pathTarget.closest('a[href], area[href]')
  return link && elementHref(link) ? link : null
}

function linkTarget(link: Element): string {
  return (link.getAttribute('target') ?? '').trim().toLowerCase()
}

function eligibleLink(link: Element): URL | null {
  const href = elementHref(link)
  if (!href) return null
  if (link.hasAttribute('download') || link.hasAttribute('data-nib-navigation-reload')) {
    return null
  }
  const target = linkTarget(link)
  if (target && target !== '_self') return null

  try {
    const url = new URL(href, location.href)
    if (
      url.origin !== location.origin
      || (url.protocol !== 'http:' && url.protocol !== 'https:')
    ) {
      return null
    }
    return url
  } catch {
    return null
  }
}

type PrefetchMode = 'hover' | 'load' | 'tap' | 'viewport'

function prefetchMode(link: Element): PrefetchMode | null {
  const value = link.getAttribute('data-nib-prefetch')
  if (value === 'false') return null
  if (value === 'tap' || value === 'load' || value === 'viewport') return value
  // The opt-in plugin defaults ordinary eligible links to hover intent.
  return 'hover'
}

function scriptTypeIsExecutable(script: HTMLScriptElement): boolean {
  const type = (script.getAttribute('type') ?? '').trim().toLowerCase()
  return type === '' || type === 'module' || type === 'text/javascript'
}

function resolvedAttribute(
  element: Element,
  attribute: string,
  baseUrl: URL,
): string {
  const value = element.getAttribute(attribute)
  if (!value) return ''
  try {
    return new URL(value, baseUrl).href
  } catch {
    return value
  }
}

function scriptIdentity(script: HTMLScriptElement, baseUrl: URL): string {
  const source = resolvedAttribute(script, 'src', baseUrl)
  const type = script.getAttribute('type') ?? ''
  return source
    ? `src:${type}:${source}`
    : `inline:${type}:${script.textContent ?? ''}`
}

function seedExecutedScripts(executedScripts: Set<string>) {
  const baseUrl = new URL(location.href)
  for (const script of document.scripts) {
    if (!scriptTypeIsExecutable(script)) continue
    executedScripts.add(scriptIdentity(script, baseUrl))
    script.setAttribute(EXECUTED_SCRIPT_ATTRIBUTE, '')
  }
}

function markPreviouslyExecutedScripts(
  executedScripts: Set<string>,
  nextDocument: Document,
  nextUrl: URL,
) {
  for (const script of nextDocument.scripts) {
    if (!scriptTypeIsExecutable(script)) {
      script.setAttribute(EXECUTED_SCRIPT_ATTRIBUTE, '')
      continue
    }
    const identity = scriptIdentity(script, nextUrl)
    if (
      !script.hasAttribute(RERUN_SCRIPT_ATTRIBUTE)
      && executedScripts.has(identity)
    ) {
      script.setAttribute(EXECUTED_SCRIPT_ATTRIBUTE, '')
    }
  }
}

async function executeNewScripts(
  executedScripts: Set<string>,
  nextUrl: URL,
  signal: AbortSignal,
) {
  for (const script of [...document.scripts]) {
    if (signal.aborted) return
    if (
      script.getAttribute(EXECUTED_SCRIPT_ATTRIBUTE) === ''
      || !scriptTypeIsExecutable(script)
    ) {
      continue
    }

    const identity = scriptIdentity(script, nextUrl)
    const replacement = document.createElement('script')
    for (const attribute of script.attributes) {
      replacement.setAttribute(attribute.name, attribute.value)
    }
    replacement.textContent = script.textContent
    replacement.setAttribute(EXECUTED_SCRIPT_ATTRIBUTE, '')
    executedScripts.add(identity)

    const source = replacement.getAttribute('src')
    const waitsForLoad = source !== null || replacement.type === 'module'
    const loaded = waitsForLoad
      ? new Promise<void>((resolve, reject) => {
          replacement.addEventListener('load', () => resolve(), { once: true })
          replacement.addEventListener(
            'error',
            () => reject(new Error(`Failed to execute navigation script ${source ?? 'inline module'}`)),
            { once: true },
          )
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Navigation aborted', 'AbortError')),
            { once: true },
          )
        })
      : Promise.resolve()
    script.replaceWith(replacement)
    await loaded
  }
}

function headNodesMatch(
  current: Element,
  next: Element,
  currentUrl: URL,
  nextUrl: URL,
): boolean {
  const persistKey = current.getAttribute(PERSIST_ATTRIBUTE)
  if (
    persistKey !== null
    && persistKey === next.getAttribute(PERSIST_ATTRIBUTE)
    && current.localName === next.localName
  ) {
    return true
  }

  if (
    current.matches('link[rel="stylesheet"]')
    && next.matches('link[rel="stylesheet"]')
  ) {
    return resolvedAttribute(current, 'href', currentUrl)
      === resolvedAttribute(next, 'href', nextUrl)
  }
  if (
    current.matches('link[rel="preload"][as="font"]')
    && next.matches('link[rel="preload"][as="font"]')
  ) {
    return resolvedAttribute(current, 'href', currentUrl)
      === resolvedAttribute(next, 'href', nextUrl)
  }
  if (current instanceof HTMLStyleElement && next instanceof HTMLStyleElement) {
    return current.textContent === next.textContent
  }
  if (
    current instanceof HTMLScriptElement
    && next instanceof HTMLScriptElement
  ) {
    if (next.hasAttribute(RERUN_SCRIPT_ATTRIBUTE)) return false
    return scriptIdentity(current, currentUrl) === scriptIdentity(next, nextUrl)
  }
  return current.isEqualNode(next)
}

function syncHead(nextDocument: Document, currentUrl: URL, nextUrl: URL) {
  const nextNodes = [...nextDocument.head.children]
  const currentNodes = [...document.head.children]
  const reused = new Set<Element>()
  const desired: Element[] = []
  for (const next of nextNodes) {
    const current = currentNodes.find((candidate) => (
      !reused.has(candidate)
      && headNodesMatch(candidate, next, currentUrl, nextUrl)
    ))
    if (current) {
      reused.add(current)
      desired.push(current)
    } else {
      desired.push(document.importNode(next, true))
    }
  }
  // Appending an existing child moves it without recreating an executed script.
  for (const node of desired) document.head.append(node)
  for (const current of currentNodes) {
    if (!reused.has(current)) current.remove()
  }
}

function preloadNewStyles(
  nextDocument: Document,
  currentUrl: URL,
  nextUrl: URL,
  signal: AbortSignal,
): Promise<void>[] {
  const currentStyles = new Set(
    [...document.querySelectorAll<HTMLLinkElement>('head link[rel="stylesheet"]')]
      .map((link) => resolvedAttribute(link, 'href', currentUrl)),
  )
  const pending: Promise<void>[] = []

  for (const stylesheet of nextDocument.querySelectorAll<HTMLLinkElement>(
    'head link[rel="stylesheet"][href]',
  )) {
    const href = resolvedAttribute(stylesheet, 'href', nextUrl)
    if (!href || currentStyles.has(href)) continue

    const preload = document.createElement('link')
    preload.rel = 'preload'
    preload.as = 'style'
    preload.href = href
    preload.dataset.nibNavigationPreload = ''
    for (const attribute of [
      'crossorigin',
      'integrity',
      'referrerpolicy',
      'fetchpriority',
    ]) {
      const value = stylesheet.getAttribute(attribute)
      if (value !== null) preload.setAttribute(attribute, value)
    }
    pending.push(new Promise((resolve, reject) => {
      let settled = false
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        preload.remove()
        if (error) reject(error)
        else resolve()
      }
      const timeout = window.setTimeout(
        () => finish(new Error(`Timed out preloading navigation stylesheet ${href}`)),
        5_000,
      )
      preload.addEventListener('load', () => finish(), { once: true })
      preload.addEventListener(
        'error',
        () => finish(new Error(`Failed to preload navigation stylesheet ${href}`)),
        { once: true },
      )
      signal.addEventListener(
        'abort',
        () => finish(new DOMException('Navigation aborted', 'AbortError')),
        { once: true },
      )
      document.head.append(preload)
    }))
  }

  return pending
}

function copyAttributes(from: Element, to: Element, preserved: string[] = []) {
  const preservedValues = new Map(
    preserved
      .filter((name) => to.hasAttribute(name))
      .map((name) => [name, to.getAttribute(name) ?? '']),
  )
  for (const attribute of [...to.attributes]) to.removeAttribute(attribute.name)
  for (const attribute of [...from.attributes]) {
    to.setAttribute(attribute.name, attribute.value)
  }
  for (const [name, value] of preservedValues) to.setAttribute(name, value)
}

function persistenceIndex(
  root: ParentNode,
  owner: string,
): Map<string, HTMLElement> {
  const result = new Map<string, HTMLElement>()
  for (const element of root.querySelectorAll<HTMLElement>(`[${PERSIST_ATTRIBUTE}]`)) {
    const key = element.getAttribute(PERSIST_ATTRIBUTE)?.trim()
    if (!key) throw new Error(`${owner} persistence keys must be non-empty`)
    if (result.has(key)) {
      throw new Error(`${owner} contains duplicate persistence key "${key}"`)
    }
    result.set(key, element)
  }
  return result
}

function restorePersistedElements(
  currentRoot: HTMLElement,
  nextRoot: HTMLElement,
): (() => void) | undefined {
  const active = document.activeElement
  let restoreFocus: (() => void) | undefined
  const currentElements = [...currentRoot.querySelectorAll<HTMLElement>(
    `[${PERSIST_ATTRIBUTE}]`,
  )]
  persistenceIndex(currentRoot, 'Current root')
  const nextPersisted = persistenceIndex(nextRoot, 'Next root')
  const persisted = currentElements.filter((element) => !element.parentElement?.closest(
    `[${PERSIST_ATTRIBUTE}]`,
  ))

  for (const element of persisted) {
    const key = element.getAttribute(PERSIST_ATTRIBUTE)!
    const target = nextPersisted.get(key)
    if (!target || target.localName !== element.localName) continue

    if (active instanceof HTMLElement && element.contains(active)) {
      const selection = (
        active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
      )
        ? { start: active.selectionStart, end: active.selectionEnd }
        : undefined
      restoreFocus = () => {
        active.focus()
        if (
          selection
          && (active instanceof HTMLInputElement
            || active instanceof HTMLTextAreaElement)
        ) {
          active.selectionStart = selection.start
          active.selectionEnd = selection.end
        }
      }
    }
    target.replaceWith(element)
  }

  return restoreFocus
}

function scrollToHash(url: URL): boolean {
  if (!url.hash) return false
  let id: string
  try {
    id = decodeURIComponent(url.hash.slice(1))
  } catch {
    id = url.hash.slice(1)
  }
  const target = document.getElementById(id)
    ?? document.querySelector<HTMLElement>(`[name="${CSS.escape(id)}"]`)
  if (!target) {
    window.scrollTo({ left: 0, top: 0, behavior: 'auto' })
    return false
  }
  target.scrollIntoView()
  if (
    target.matches(
      'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
    )
  ) {
    target.focus({ preventScroll: true })
  }
  return true
}

function announceRoute(timers: Set<number>) {
  document.querySelector('.nib-route-announcer')?.remove()
  const announcer = document.createElement('div')
  announcer.className = 'nib-route-announcer sr-only'
  announcer.setAttribute('aria-live', 'assertive')
  announcer.setAttribute('aria-atomic', 'true')
  document.body.append(announcer)
  const timer = window.setTimeout(() => {
    timers.delete(timer)
    announcer.textContent = document.title
      || document.querySelector('h1')?.textContent
      || location.pathname
  }, 60)
  timers.add(timer)
}

function lifecycleDetail(
  from: URL,
  to: URL,
  context: NavigationContext,
): NavigationLifecycleDetail {
  return {
    direction: context.direction,
    from,
    navigationType: context.history,
    ...(context.sourceElement === undefined
      ? {}
      : { sourceElement: context.sourceElement }),
    to,
  }
}

function navigationEvent(
  nextDocument: Document,
  from: URL,
  to: URL,
  context: NavigationContext,
  signal: AbortSignal,
  swap: () => void | Promise<void>,
  viewTransition?: ViewTransition,
): CustomEvent<NavigationBeforeSwapDetail> {
  return new CustomEvent<NavigationBeforeSwapDetail>(
    'nib:navigation-before-swap',
    {
      detail: {
        ...lifecycleDetail(from, to, context),
        newDocument: nextDocument,
        signal,
        swap,
        ...(viewTransition === undefined ? {} : { viewTransition }),
      },
    },
  )
}

class NibClientNavigation implements ClientNavigationController {
  private controller: AbortController | undefined
  private currentIndex = 0
  private currentUrl = new URL(location.href)
  private readonly executedScripts = new Set<string>()
  private hoverTimer = 0
  private mounted = false
  private navigationAbort: AbortController | undefined
  private readonly pageCache = new NavigationPageCache()
  private scrollFrame = 0
  private viewportObserver: IntersectionObserver | undefined
  private readonly viewportTimers = new Map<Element, number>()
  private readonly announcementTimers = new Set<number>()
  private activeTransition: ViewTransition | undefined

  mount = () => {
    if (this.mounted) return
    this.mounted = true
    this.controller = new AbortController()
    this.currentUrl = new URL(location.href)
    const state = navigationState()
    const existingIndex = stateNumber(state, HISTORY_INDEX, Number.NaN)
    this.currentIndex = Number.isFinite(existingIndex) ? existingIndex : 0
    if (!Number.isFinite(existingIndex)) {
      history.replaceState({
        ...state,
        [HISTORY_INDEX]: this.currentIndex,
        [HISTORY_SCROLL_X]: window.scrollX,
        [HISTORY_SCROLL_Y]: window.scrollY,
      }, '')
    } else {
      window.scrollTo({
        left: stateNumber(state, HISTORY_SCROLL_X, window.scrollX),
        top: stateNumber(state, HISTORY_SCROLL_Y, window.scrollY),
        behavior: 'auto',
      })
    }
    history.scrollRestoration = 'manual'
    seedExecutedScripts(this.executedScripts)
    this.bind(this.controller.signal)
    this.scanPrefetchLinks()
  }

  navigate = async (
    destination: string | URL,
    options: NavigateOptions = {},
  ): Promise<void> => {
    this.mount()
    const to = new URL(destination, location.href)
    if (
      to.origin !== location.origin
      || (to.protocol !== 'http:' && to.protocol !== 'https:')
    ) {
      this.hardNavigate(to)
      return
    }
    const from = new URL(location.href)
    if (to.pathname === from.pathname && to.search === from.search) {
      this.navigateWithinPage(to, options.history === 'replace')
      return
    }
    await this.performNavigation(to, {
      direction: 'forward',
      history: options.history ?? 'push',
      ...(options.sourceElement === undefined
        ? {}
        : { sourceElement: options.sourceElement }),
    })
  }

  destroy = () => {
    this.controller?.abort()
    this.navigationAbort?.abort()
    try {
      this.activeTransition?.skipTransition()
    } catch {
      // A completed transition has nothing left to skip.
    }
    this.viewportObserver?.disconnect()
    window.clearTimeout(this.hoverTimer)
    window.cancelAnimationFrame(this.scrollFrame)
    for (const timer of this.viewportTimers.values()) window.clearTimeout(timer)
    for (const timer of this.announcementTimers) window.clearTimeout(timer)
    this.viewportTimers.clear()
    this.announcementTimers.clear()
    this.pageCache.clear()
    this.executedScripts.clear()
    this.controller = undefined
    this.navigationAbort = undefined
    this.viewportObserver = undefined
    this.activeTransition = undefined
    this.hoverTimer = 0
    this.scrollFrame = 0
    this.mounted = false
  }

  private bind(signal: AbortSignal) {
    document.addEventListener('click', this.onClick, { signal })
    document.addEventListener('submit', this.onSubmit, { signal })
    document.addEventListener('mouseover', this.onHover, {
      passive: true,
      signal,
    })
    document.addEventListener('mouseout', this.onHoverEnd, {
      passive: true,
      signal,
    })
    document.addEventListener('focusin', this.onHover, {
      passive: true,
      signal,
    })
    document.addEventListener('focusout', this.onHoverEnd, {
      passive: true,
      signal,
    })
    document.addEventListener('touchstart', this.onTouchPrefetch, {
      passive: true,
      signal,
    })
    document.addEventListener('mousedown', this.onTouchPrefetch, {
      passive: true,
      signal,
    })
    document.addEventListener('nib:navigation-load', this.scanPrefetchLinks, {
      signal,
    })
    window.addEventListener('popstate', this.onPopState, { signal })
    window.addEventListener('scroll', this.onScroll, {
      passive: true,
      signal,
    })
    window.addEventListener('pagehide', this.snapshotScroll, { signal })
  }

  private onScroll = () => {
    if (this.scrollFrame) return
    this.scrollFrame = window.requestAnimationFrame(() => {
      this.scrollFrame = 0
      this.snapshotScroll()
    })
  }

  private snapshotScroll = () => {
    // Search, recipe, gallery, and modal URL state intentionally use
    // replaceState. Repair the router index whenever we snapshot so those
    // feature states remain traversable without a hard reload.
    replaceHistoryScroll(this.currentIndex)
  }

  private onHover = (event: Event) => {
    const link = linkFromEvent(event)
    if (!link || prefetchMode(link) !== 'hover' || connectionIsSlow()) return
    const url = eligibleLink(link)
    if (!url) return
    const signal = this.controller?.signal
    if (!signal) return
    window.clearTimeout(this.hoverTimer)
    this.hoverTimer = window.setTimeout(
      () => {
        this.hoverTimer = 0
        this.pageCache.prefetch(url, signal)
      },
      HOVER_PREFETCH_DELAY_MS,
    )
  }

  private onHoverEnd = () => {
    window.clearTimeout(this.hoverTimer)
    this.hoverTimer = 0
  }

  private onTouchPrefetch = (event: Event) => {
    const link = linkFromEvent(event)
    if (!link || prefetchMode(link) !== 'tap') return
    const url = eligibleLink(link)
    const signal = this.controller?.signal
    if (url && signal) this.pageCache.prefetch(url, signal)
  }

  private scanPrefetchLinks = () => {
    this.viewportObserver?.disconnect()
    for (const timer of this.viewportTimers.values()) window.clearTimeout(timer)
    this.viewportTimers.clear()
    const signal = this.controller?.signal
    if (!signal) return
    const viewportLinks = [...document.querySelectorAll<Element>(
      'a[href][data-nib-prefetch="viewport"], area[href][data-nib-prefetch="viewport"]',
    )]
    for (const link of document.querySelectorAll<Element>(
      'a[href][data-nib-prefetch="load"], area[href][data-nib-prefetch="load"]',
    )) {
      const url = eligibleLink(link)
      if (url) this.pageCache.prefetch(url, signal)
    }
    if (!('IntersectionObserver' in window) || viewportLinks.length === 0) {
      return
    }
    this.viewportObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        const previousTimer = this.viewportTimers.get(entry.target)
        if (!entry.isIntersecting) {
          if (previousTimer) {
            window.clearTimeout(previousTimer)
            this.viewportTimers.delete(entry.target)
          }
          continue
        }
        if (previousTimer) window.clearTimeout(previousTimer)
        const timer = window.setTimeout(() => {
          this.viewportTimers.delete(entry.target)
          observer.unobserve(entry.target)
          const url = eligibleLink(entry.target)
          if (url) this.pageCache.prefetch(url, signal)
        }, 300)
        this.viewportTimers.set(entry.target, timer)
      }
    })
    for (const link of viewportLinks) this.viewportObserver.observe(link)
  }

  private onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.altKey
      || event.shiftKey
    ) {
      return
    }
    const link = linkFromEvent(event)
    if (!link) return
    const to = eligibleLink(link)
    if (!to) return

    const from = new URL(location.href)
    if (
      to.pathname === from.pathname
      && to.search === from.search
    ) {
      event.preventDefault()
      this.navigateWithinPage(
        to,
        link.getAttribute('data-nib-navigation-history') === 'replace',
      )
      return
    }

    event.preventDefault()
    const historyMode = link.getAttribute('data-nib-navigation-history') === 'replace'
      ? 'replace'
      : 'push'
    void this.navigate(to, {
      history: historyMode,
      sourceElement: link,
    })
  }

  private onSubmit = (event: SubmitEvent) => {
    if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) {
      return
    }
    const form = event.target
    const submitter = event.submitter
    if (
      form.hasAttribute('data-nib-navigation-reload')
      || submitter?.hasAttribute('data-nib-navigation-reload')
    ) {
      return
    }
    const target = (
      submitter?.getAttribute('formtarget')
      ?? form.getAttribute('target')
      ?? ''
    ).trim().toLowerCase()
    if (target && target !== '_self') return

    const method = (
      submitter?.getAttribute('formmethod')
      ?? form.getAttribute('method')
      ?? 'get'
    ).trim().toLowerCase()
    if (method !== 'get') return
    const action = (
      submitter?.getAttribute('formaction')
      ?? form.getAttribute('action')
      ?? location.href
    )
    const to = new URL(action, location.href)
    if (to.origin !== location.origin) return

    const formData = new FormData(form, submitter ?? undefined)
    to.search = new URLSearchParams(
      [...formData.entries()].map(([key, value]) => [
        key,
        typeof value === 'string' ? value : value.name,
      ]),
    ).toString()

    event.preventDefault()
    void this.navigate(to, {
      history: 'push',
      sourceElement: submitter ?? form,
    })
  }

  private navigateWithinPage(to: URL, replace: boolean) {
    const from = new URL(location.href)
    if (to.href === from.href) {
      if (!scrollToHash(to)) {
        window.scrollTo({ left: 0, top: 0, behavior: 'auto' })
      }
      return
    }

    this.snapshotScroll()
    if (replace) {
      const state = navigationState()
      history.replaceState({
        ...state,
        [HISTORY_SCROLL_X]: 0,
        [HISTORY_SCROLL_Y]: 0,
      }, '', to)
    } else {
      this.currentIndex += 1
      history.pushState({
        [HISTORY_INDEX]: this.currentIndex,
        [HISTORY_SCROLL_X]: 0,
        [HISTORY_SCROLL_Y]: 0,
      }, '', to)
    }
    this.currentUrl = to
    if (!scrollToHash(to)) {
      window.scrollTo({ left: 0, top: 0, behavior: 'auto' })
    }
  }

  private onPopState = (event: PopStateEvent) => {
    const state = event.state as NavigationHistoryState | null
    const hasIndex = typeof state?.[HISTORY_INDEX] === 'number'
    const nextIndex = hasIndex
      ? state[HISTORY_INDEX] as number
      : Math.max(0, this.currentIndex - 1)
    const direction: NavigationDirection = nextIndex < this.currentIndex
      ? 'back'
      : 'forward'
    const to = new URL(location.href)
    const from = this.currentUrl
    this.currentIndex = nextIndex
    const restoreScroll = {
      x: stateNumber(state, HISTORY_SCROLL_X, 0),
      y: stateNumber(state, HISTORY_SCROLL_Y, 0),
    }
    if (!hasIndex) {
      history.replaceState({
        ...(state ?? {}),
        [HISTORY_INDEX]: nextIndex,
        [HISTORY_SCROLL_X]: restoreScroll.x,
        [HISTORY_SCROLL_Y]: restoreScroll.y,
      }, '')
    }

    if (to.pathname === from.pathname && to.search === from.search) {
      this.currentUrl = to
      if (!scrollToHash(to)) {
        window.scrollTo({
          left: restoreScroll.x,
          top: restoreScroll.y,
          behavior: 'auto',
        })
      }
      return
    }
    void this.performNavigation(to, {
      direction,
      from,
      history: 'traverse',
      restoreScroll,
    })
  }

  private hardNavigate(url: URL) {
    location.href = url.href
  }

  private async performNavigation(to: URL, context: NavigationContext) {
    if (context.history !== 'traverse') this.snapshotScroll()
    this.navigationAbort?.abort()
    try {
      this.activeTransition?.skipTransition()
    } catch {
      // A completed transition has nothing left to skip.
    }
    const navigationAbort = new AbortController()
    this.navigationAbort = navigationAbort
    const { signal } = navigationAbort
    const from = context.from ?? new URL(location.href)

    try {
      const prepared = await (
        this.pageCache.get(to) ?? requestPage(to, signal)
      )
      if (signal.aborted) return
      if (!prepared) {
        this.hardNavigate(to)
        return
      }

      const finalUrl = new URL(prepared.finalUrl, to)
      if (finalUrl.origin !== location.origin) {
        this.hardNavigate(finalUrl)
        return
      }
      finalUrl.hash = to.hash

      const nextDocument = new DOMParser().parseFromString(
        prepared.html,
        prepared.mediaType,
      )
      nextDocument.querySelectorAll('noscript').forEach((node) => node.remove())
      if (!nextDocument.getElementById('root')) {
        this.hardNavigate(finalUrl)
        return
      }
      persistenceIndex(document, 'Current document')
      persistenceIndex(nextDocument, 'Next document')
      markPreviouslyExecutedScripts(this.executedScripts, nextDocument, finalUrl)
      const pendingStyles = preloadNewStyles(
        nextDocument,
        from,
        finalUrl,
        signal,
      )
      if (pendingStyles.length > 0) await Promise.all(pendingStyles)
      if (signal.aborted) return

      document.documentElement.setAttribute(
        'data-nib-navigation-direction',
        context.direction,
      )
      const swap = async () => {
        await this.swapDocument(
          nextDocument,
          from,
          finalUrl,
          context,
          signal,
        )
      }
      const completeNavigation = async () => {
        await executeNewScripts(this.executedScripts, finalUrl, signal)
        if (signal.aborted) return
        mountClientRuntimes(document)
        await Promise.resolve()
        document.dispatchEvent(new CustomEvent<NavigationLifecycleDetail>(
          'nib:navigation-load',
          { detail: lifecycleDetail(from, finalUrl, context) },
        ))
        announceRoute(this.announcementTimers)
      }

      if (typeof document.startViewTransition === 'function') {
        let transition: ViewTransition
        transition = document.startViewTransition(() => swap())
        this.activeTransition = transition
        try {
          await transition.updateCallbackDone
        } catch (error) {
          if (!signal.aborted) throw error
        }
        await completeNavigation()
        void transition.finished.catch(() => {
          // A skipped or rejected transition still uses the completed DOM path.
        }).finally(() => {
          if (this.activeTransition === transition) {
            this.activeTransition = undefined
          }
          document.documentElement.removeAttribute('data-nib-navigation-direction')
          document.documentElement.removeAttribute(
            'data-nib-navigation-fallback',
          )
        })
      } else {
        document.documentElement.setAttribute(
          'data-nib-navigation-fallback',
          'swap',
        )
        await swap()
        await completeNavigation()
        document.documentElement.removeAttribute('data-nib-navigation-direction')
        document.documentElement.removeAttribute(
          'data-nib-navigation-fallback',
        )
      }
    } catch (error) {
      if (signal.aborted) return
      console.error('[nib-navigation] Navigation failed', error)
      this.hardNavigate(to)
    } finally {
      if (this.navigationAbort === navigationAbort) {
        this.navigationAbort = undefined
      }
    }
  }

  private async swapDocument(
    nextDocument: Document,
    from: URL,
    to: URL,
    context: NavigationContext,
    signal: AbortSignal,
  ) {
    const currentRoot = document.getElementById('root')
    const nextRoot = nextDocument.getElementById('root')
    if (!(currentRoot instanceof HTMLElement) || !(nextRoot instanceof HTMLElement)) {
      throw new Error('Client navigation requires a #root element')
    }

    let restoreFocus: (() => void) | undefined
    let defaultSwapCalled = false
    const defaultSwap = () => {
      if (defaultSwapCalled) return
      defaultSwapCalled = true
      syncHead(nextDocument, from, to)
      copyAttributes(
        nextDocument.documentElement,
        document.documentElement,
        ['data-nib-navigation-direction', 'data-nib-navigation-fallback'],
      )
      copyAttributes(nextDocument.body, document.body)
      restoreFocus = restorePersistedElements(currentRoot, nextRoot)
      unmountClientRuntimes(currentRoot)
      currentRoot.replaceWith(nextRoot)
    }
    const beforeSwap = navigationEvent(
      nextDocument,
      from,
      to,
      context,
      signal,
      defaultSwap,
      this.activeTransition,
    )
    document.dispatchEvent(beforeSwap)
    if (signal.aborted) return
    await beforeSwap.detail.swap()
    if (signal.aborted) return

    this.commitHistory(to, context)
    restoreFocus?.()
    if (context.restoreScroll) {
      window.scrollTo({
        left: context.restoreScroll.x,
        top: context.restoreScroll.y,
        behavior: 'auto',
      })
    } else if (!scrollToHash(to)) {
      window.scrollTo({ left: 0, top: 0, behavior: 'auto' })
    }

    document.dispatchEvent(new CustomEvent<NavigationLifecycleDetail>(
      'nib:navigation-after-swap',
      { detail: lifecycleDetail(from, to, context) },
    ))
  }

  private commitHistory(to: URL, context: NavigationContext) {
    if (context.history === 'replace') {
      const state = navigationState()
      history.replaceState({
        ...state,
        [HISTORY_INDEX]: this.currentIndex,
        [HISTORY_SCROLL_X]: 0,
        [HISTORY_SCROLL_Y]: 0,
      }, '', to)
    } else if (context.history === 'push') {
      this.currentIndex += 1
      history.pushState({
        [HISTORY_INDEX]: this.currentIndex,
        [HISTORY_SCROLL_X]: 0,
        [HISTORY_SCROLL_Y]: 0,
      }, '', to)
    }
    this.currentUrl = to
  }
}

/** Creates an unmounted navigation controller with no global ownership. */
export function createClientNavigation(): ClientNavigationController {
  return new NibClientNavigation()
}

let startedController: ClientNavigationController | undefined

/** Starts the generated plugin entry exactly once and returns its controller. */
export function startClientNavigation(): ClientNavigationController {
  if (startedController === undefined) {
    startedController = createClientNavigation()
  }
  startedController.mount()
  return startedController
}

/** Destroys the generated plugin-owned controller, primarily for HMR and tests. */
export function stopClientNavigation(): void {
  startedController?.destroy()
  startedController = undefined
}
