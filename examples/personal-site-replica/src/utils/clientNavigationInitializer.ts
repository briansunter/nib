type NavigationDirection = 'back' | 'forward'
type NavigationType = 'push' | 'replace' | 'traverse'

interface ClientNavigationOptions {
  mount: (root?: ParentNode) => void
  unmount: (root?: ParentNode) => void
}

interface NavigationRequest {
  body?: BodyInit
  method?: string
}

interface FetchedPage {
  finalUrl: string
  html: string
  mediaType: DOMParserSupportedType
}

interface CachedPage {
  createdAt: number
  promise: Promise<FetchedPage | null>
}

interface NavigationContext {
  direction: NavigationDirection
  from?: URL
  history: NavigationType
  request?: NavigationRequest
  restoreScroll?: { x: number; y: number }
  sourceElement?: Element
}

interface ClientNavigationController {
  destroy: () => void
  setRuntime: (options: ClientNavigationOptions) => void
}

interface NavigationHistoryState {
  __nibNavigationIndex?: number
  __nibScrollX?: number
  __nibScrollY?: number
  [key: string]: unknown
}

interface NavigationEvent extends Event {
  direction: NavigationDirection
  from: URL
  navigationType: NavigationType
  newDocument: Document
  signal: AbortSignal
  sourceElement?: Element
  swap: () => void
  to: URL
  viewTransition?: ViewTransition
}

interface NetworkInformationLike {
  effectiveType?: string
  saveData?: boolean
}

declare global {
  interface Window {
    __nibPersonalSiteClientNavigation?: ClientNavigationController
  }
}

const CACHE_TTL_MS = 30_000
const HOVER_PREFETCH_DELAY_MS = 80
const MAX_PREFETCHED_PAGES = 40
const HISTORY_INDEX = '__nibNavigationIndex'
const HISTORY_SCROLL_X = '__nibScrollX'
const HISTORY_SCROLL_Y = '__nibScrollY'
const PERSIST_ATTRIBUTE = 'data-astro-transition-persist'
const EXECUTED_SCRIPT_ATTRIBUTE = 'data-astro-exec'
const RERUN_SCRIPT_ATTRIBUTE = 'data-astro-rerun'

const pageCache = new Map<string, CachedPage>()
const executedScripts = new Set<string>()

function navigationState(): NavigationHistoryState {
  const state = history.state
  return state && typeof state === 'object'
    ? state as NavigationHistoryState
    : {}
}

function stateNumber(
  state: NavigationHistoryState | null,
  key: keyof NavigationHistoryState,
  fallback: number,
): number {
  const value = state?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function replaceHistoryScroll(
  index: number,
  x = window.scrollX,
  y = window.scrollY,
) {
  const state = navigationState()
  history.replaceState({
    ...state,
    [HISTORY_INDEX]: index,
    [HISTORY_SCROLL_X]: x,
    [HISTORY_SCROLL_Y]: y,
  }, '')
}

function normalizedFetchUrl(url: URL): string {
  const normalized = new URL(url)
  normalized.hash = ''
  return normalized.href
}

function isHtmlMediaType(value: string): value is DOMParserSupportedType {
  return value === 'text/html' || value === 'application/xhtml+xml'
}

function isSlowConnection(): boolean {
  const connection = (
    navigator as Navigator & { connection?: NetworkInformationLike }
  ).connection
  return connection?.saveData === true
    || /(^|-)2g$/.test(connection?.effectiveType ?? '')
}

function canPrefetch(): boolean {
  return navigator.onLine !== false
}

function trimPageCache() {
  while (pageCache.size > MAX_PREFETCHED_PAGES) {
    const oldest = pageCache.keys().next().value
    if (typeof oldest !== 'string') return
    pageCache.delete(oldest)
  }
}

async function requestPage(
  url: URL,
  request: NavigationRequest | undefined,
  signal?: AbortSignal,
): Promise<FetchedPage | null> {
  try {
    const response = await fetch(normalizedFetchUrl(url), {
      body: request?.body,
      credentials: 'same-origin',
      headers: {
        Accept: 'text/html, application/xhtml+xml',
      },
      method: request?.method ?? 'GET',
      redirect: 'follow',
      signal,
    })
    const mediaType = (response.headers.get('content-type') ?? '')
      .split(';', 1)[0]
      ?.trim()
    if (!mediaType || !isHtmlMediaType(mediaType)) return null
    return {
      finalUrl: response.url || normalizedFetchUrl(url),
      html: await response.text(),
      mediaType,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return null
  }
}

function cachedPage(url: URL): Promise<FetchedPage | null> | undefined {
  const key = normalizedFetchUrl(url)
  const cached = pageCache.get(key)
  if (!cached) return undefined
  if (Date.now() - cached.createdAt > CACHE_TTL_MS) {
    pageCache.delete(key)
    return undefined
  }
  // Refresh insertion order so the cache is bounded by least-recent use.
  pageCache.delete(key)
  pageCache.set(key, cached)
  return cached.promise
}

function prefetchPage(url: URL, ignoreSlowConnection = false) {
  if (!canPrefetch() || (!ignoreSlowConnection && isSlowConnection())) return
  if (url.origin !== location.origin) return

  const key = normalizedFetchUrl(url)
  if (key === normalizedFetchUrl(new URL(location.href))) return
  if (cachedPage(url)) return

  const promise = requestPage(url, undefined)
  pageCache.set(key, { createdAt: Date.now(), promise })
  trimPageCache()
  void promise.then((page) => {
    if (!page) pageCache.delete(key)
  })
}

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
  if (link.hasAttribute('download') || link.hasAttribute('data-astro-reload')) {
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
  const value = link.getAttribute('data-astro-prefetch')
  if (value === 'false') return null
  if (value === 'tap' || value === 'load' || value === 'viewport') return value
  // ClientRouter enables prefetchAll, whose default strategy is hover.
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

function seedExecutedScripts() {
  const baseUrl = new URL(location.href)
  for (const script of document.scripts) {
    if (!scriptTypeIsExecutable(script)) continue
    executedScripts.add(scriptIdentity(script, baseUrl))
    script.dataset.astroExec = ''
  }
}

function markPreviouslyExecutedScripts(nextDocument: Document, nextUrl: URL) {
  for (const script of nextDocument.scripts) {
    if (!scriptTypeIsExecutable(script)) {
      script.dataset.astroExec = ''
      continue
    }
    const identity = scriptIdentity(script, nextUrl)
    if (
      !script.hasAttribute(RERUN_SCRIPT_ATTRIBUTE)
      && executedScripts.has(identity)
    ) {
      script.dataset.astroExec = ''
    }
  }
}

async function executeNewScripts(nextUrl: URL, signal: AbortSignal) {
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
    replacement.dataset.astroExec = ''
    executedScripts.add(identity)

    const source = replacement.getAttribute('src')
    const loaded = source
      ? new Promise<void>((resolve) => {
          replacement.addEventListener('load', () => resolve(), { once: true })
          replacement.addEventListener('error', () => resolve(), { once: true })
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
    return scriptIdentity(current, currentUrl) === scriptIdentity(next, nextUrl)
  }
  return current.isEqualNode(next)
}

function syncHead(nextDocument: Document, currentUrl: URL, nextUrl: URL) {
  const nextNodes = [...nextDocument.head.children]
  const reused = new Set<Element>()

  for (const current of [...document.head.children]) {
    const match = nextNodes.find((candidate) => (
      !reused.has(candidate)
      && headNodesMatch(current, candidate, currentUrl, nextUrl)
    ))
    if (match) reused.add(match)
    else current.remove()
  }

  for (const next of nextNodes) {
    if (reused.has(next)) continue
    document.head.append(document.importNode(next, true))
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
    preload.dataset.clientNavigationPreload = ''
    pending.push(new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        preload.remove()
        resolve()
      }
      const timeout = window.setTimeout(finish, 5_000)
      preload.addEventListener('load', finish, { once: true })
      preload.addEventListener('error', finish, { once: true })
      signal.addEventListener('abort', finish, { once: true })
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

function restorePersistedElements(
  currentRoot: HTMLElement,
  nextRoot: HTMLElement,
): (() => void) | undefined {
  const active = document.activeElement
  let restoreFocus: (() => void) | undefined
  const persisted = [...currentRoot.querySelectorAll<HTMLElement>(
    `[${PERSIST_ATTRIBUTE}]`,
  )].filter((element) => !element.parentElement?.closest(
    `[${PERSIST_ATTRIBUTE}]`,
  ))
  const nextPersisted = [...nextRoot.querySelectorAll<HTMLElement>(
    `[${PERSIST_ATTRIBUTE}]`,
  )]

  for (const element of persisted) {
    const key = element.getAttribute(PERSIST_ATTRIBUTE)
    const target = nextPersisted.find((candidate) => (
      candidate.getAttribute(PERSIST_ATTRIBUTE) === key
      && candidate.localName === element.localName
    ))
    if (!target) continue

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

function announceRoute() {
  document.querySelector('.astro-route-announcer')?.remove()
  const announcer = document.createElement('div')
  announcer.className = 'astro-route-announcer sr-only'
  announcer.setAttribute('aria-live', 'assertive')
  announcer.setAttribute('aria-atomic', 'true')
  document.body.append(announcer)
  window.setTimeout(() => {
    announcer.textContent = document.title
      || document.querySelector('h1')?.textContent
      || location.pathname
  }, 60)
}

function navigationEvent(
  nextDocument: Document,
  from: URL,
  to: URL,
  context: NavigationContext,
  signal: AbortSignal,
  swap: () => void,
  viewTransition?: ViewTransition,
): NavigationEvent {
  const event = new Event('astro:before-swap') as NavigationEvent
  Object.assign(event, {
    direction: context.direction,
    from,
    navigationType: context.history,
    newDocument: nextDocument,
    signal,
    sourceElement: context.sourceElement,
    swap,
    to,
    viewTransition,
  })
  return event
}

class PersonalSiteClientNavigation implements ClientNavigationController {
  private readonly controller = new AbortController()
  private currentIndex: number
  private currentUrl = new URL(location.href)
  private hoverTimer = 0
  private navigationAbort?: AbortController
  private mountRuntime: (root?: ParentNode) => void
  private unmountRuntime: (root?: ParentNode) => void
  private scrollFrame = 0
  private viewportObserver?: IntersectionObserver
  private readonly viewportTimers = new WeakMap<Element, number>()
  private activeTransition?: ViewTransition

  constructor(options: ClientNavigationOptions) {
    this.mountRuntime = options.mount
    this.unmountRuntime = options.unmount
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
    seedExecutedScripts()
    this.bind()
    this.scanPrefetchLinks()
    window.dispatchEvent(new Event('nib:client-navigation-ready'))
  }

  setRuntime = (options: ClientNavigationOptions) => {
    this.mountRuntime = options.mount
    this.unmountRuntime = options.unmount
  }

  destroy = () => {
    this.controller.abort()
    this.navigationAbort?.abort()
    this.activeTransition?.skipTransition()
    this.viewportObserver?.disconnect()
    window.clearTimeout(this.hoverTimer)
    window.cancelAnimationFrame(this.scrollFrame)
    if (window.__nibPersonalSiteClientNavigation === this) {
      delete window.__nibPersonalSiteClientNavigation
    }
  }

  private bind() {
    const { signal } = this.controller
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
    document.addEventListener('astro:page-load', this.scanPrefetchLinks, {
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
    if (!link || prefetchMode(link) !== 'hover' || isSlowConnection()) return
    const url = eligibleLink(link)
    if (!url) return
    window.clearTimeout(this.hoverTimer)
    this.hoverTimer = window.setTimeout(
      () => prefetchPage(url),
      HOVER_PREFETCH_DELAY_MS,
    )
  }

  private onHoverEnd = () => {
    window.clearTimeout(this.hoverTimer)
    this.hoverTimer = 0
  }

  private onTouchPrefetch = (event: Event) => {
    const link = linkFromEvent(event)
    if (!link || !prefetchMode(link)) return
    const url = eligibleLink(link)
    if (url) prefetchPage(url, true)
  }

  private scanPrefetchLinks = () => {
    this.viewportObserver?.disconnect()
    const viewportLinks = [...document.querySelectorAll<Element>(
      'a[href][data-astro-prefetch="viewport"], area[href][data-astro-prefetch="viewport"]',
    )]
    for (const link of document.querySelectorAll<Element>(
      'a[href][data-astro-prefetch="load"], area[href][data-astro-prefetch="load"]',
    )) {
      const url = eligibleLink(link)
      if (url) prefetchPage(url)
    }
    if (!('IntersectionObserver' in window) || viewportLinks.length === 0) {
      return
    }
    this.viewportObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        const previousTimer = this.viewportTimers.get(entry.target)
        if (!entry.isIntersecting) {
          if (previousTimer) window.clearTimeout(previousTimer)
          continue
        }
        if (previousTimer) window.clearTimeout(previousTimer)
        const timer = window.setTimeout(() => {
          observer.unobserve(entry.target)
          const url = eligibleLink(entry.target)
          if (url) prefetchPage(url)
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
        link.getAttribute('data-astro-history') === 'replace',
      )
      return
    }

    event.preventDefault()
    const historyMode = link.getAttribute('data-astro-history') === 'replace'
      ? 'replace'
      : 'push'
    void this.navigate(to, {
      direction: 'forward',
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
      form.hasAttribute('data-astro-reload')
      || submitter?.hasAttribute('data-astro-reload')
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
    if (method === 'dialog') return
    const action = (
      submitter?.getAttribute('formaction')
      ?? form.getAttribute('action')
      ?? location.href
    )
    const to = new URL(action, location.href)
    if (to.origin !== location.origin) return

    const formData = new FormData(form, submitter ?? undefined)
    let request: NavigationRequest | undefined
    if (method === 'get') {
      to.search = new URLSearchParams(
        [...formData.entries()].map(([key, value]) => [
          key,
          typeof value === 'string' ? value : value.name,
        ]),
      ).toString()
    } else {
      const encoding = (
        submitter?.getAttribute('formenctype')
        ?? form.enctype
      ).toLowerCase()
      request = {
        body: encoding === 'application/x-www-form-urlencoded'
          ? new URLSearchParams(
              [...formData.entries()].map(([key, value]) => [
                key,
                typeof value === 'string' ? value : value.name,
              ]),
            )
          : formData,
        method: method.toUpperCase(),
      }
    }

    event.preventDefault()
    void this.navigate(to, {
      direction: 'forward',
      history: 'push',
      request,
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
    void this.navigate(to, {
      direction,
      from,
      history: 'traverse',
      restoreScroll,
    })
  }

  private hardNavigate(url: URL) {
    location.href = url.href
  }

  private async navigate(to: URL, context: NavigationContext) {
    if (context.history !== 'traverse') this.snapshotScroll()
    this.navigationAbort?.abort()
    this.activeTransition?.skipTransition()
    const navigationAbort = new AbortController()
    this.navigationAbort = navigationAbort
    const { signal } = navigationAbort
    const from = context.from ?? new URL(location.href)

    try {
      const prepared = context.request
        ? await requestPage(to, context.request, signal)
        : await (cachedPage(to) ?? requestPage(to, undefined, signal))
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
      markPreviouslyExecutedScripts(nextDocument, finalUrl)
      const pendingStyles = preloadNewStyles(
        nextDocument,
        from,
        finalUrl,
        signal,
      )
      if (pendingStyles.length > 0) await Promise.all(pendingStyles)
      if (signal.aborted) return

      document.documentElement.setAttribute(
        'data-astro-transition',
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
        await executeNewScripts(finalUrl, signal)
        if (signal.aborted) return
        this.mountRuntime(document)
        await Promise.resolve()
        document.dispatchEvent(new Event('astro:page-load'))
        announceRoute()
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
        void transition.finished.finally(() => {
          if (this.activeTransition === transition) {
            this.activeTransition = undefined
          }
          document.documentElement.removeAttribute('data-astro-transition')
          document.documentElement.removeAttribute(
            'data-astro-transition-fallback',
          )
        })
      } else {
        document.documentElement.setAttribute(
          'data-astro-transition-fallback',
          'swap',
        )
        await swap()
        await completeNavigation()
        document.documentElement.removeAttribute('data-astro-transition')
        document.documentElement.removeAttribute(
          'data-astro-transition-fallback',
        )
      }
    } catch (error) {
      if (signal.aborted) return
      console.error('[client-navigation] Navigation failed', error)
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
    const defaultSwap = () => {
      syncHead(nextDocument, from, to)
      copyAttributes(
        nextDocument.documentElement,
        document.documentElement,
        ['data-astro-transition', 'data-astro-transition-fallback'],
      )
      copyAttributes(nextDocument.body, document.body)
      restoreFocus = restorePersistedElements(currentRoot, nextRoot)
      this.unmountRuntime(currentRoot)
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
    beforeSwap.swap()

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

    document.dispatchEvent(new Event('astro:after-swap'))
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

/**
 * Installs one site-wide ClientRouter-compatible runtime. It deliberately
 * survives shell replacement; every subsequently mounted shell behavior calls
 * this function again and refreshes the public runtime controllers.
 */
export function initClientNavigation(options: ClientNavigationOptions): void {
  const existing = window.__nibPersonalSiteClientNavigation
  if (existing) {
    existing.setRuntime(options)
    return
  }
  window.__nibPersonalSiteClientNavigation = new PersonalSiteClientNavigation(
    options,
  )
}

export function destroyClientNavigation(): void {
  window.__nibPersonalSiteClientNavigation?.destroy()
}
