import {
  mountClientRuntimes,
  unmountClientRuntimes,
} from '../runtime/coordinator'
import {
  HISTORY_INDEX,
  HISTORY_SCROLL_X,
  HISTORY_SCROLL_Y,
  HISTORY_WRITE_EVENT,
  navigationState,
  type NavigationHistoryWriteDetail,
  replaceHistoryScroll,
  stateNumber,
} from './history'
import {
  NavigationPageCache,
  requestPage,
} from './page-cache'
import {
  effectiveNavigationTarget,
  eligibleLink,
  HOVER_PREFETCH_DELAY_MS,
  linkFromEvent,
  prefetchMode,
} from './link-policy'
import { announceRoute, focusRouteContent, scrollToHash } from './accessibility'
import { persistenceIndex, restorePersistedElements } from './persistence'
import {
  abortable,
  absolutizeHeadResources,
  activateNavigationBase,
  copyAttributes,
  currentScriptIdentities,
  executeNewScripts,
  initialDocumentStyles,
  markPreviouslyExecutedScripts,
  preloadNewStyles,
  prepareNavigationBase,
  runtimeEntryChanged,
  seedExecutedScripts,
  stylesheetHrefs,
  syncHead,
  TRANSIENT_BASE_ATTRIBUTE,
} from './document-sync'
import type {
  ClientNavigationController,
  ClientNavigationOptions,
  NavigateOptions,
  NavigationBeforeSwapDetail,
  NavigationContext,
  NavigationDirection,
  NavigationHistoryState,
  NavigationLifecycleDetail,
  NavigationPrefetchPolicy,
} from './types'
export type {
  ClientNavigationController,
  ClientNavigationOptions,
  NavigateOptions,
  NavigationBeforeSwapDetail,
  NavigationDirection,
  NavigationLifecycleDetail,
  NavigationPrefetchPolicy,
  NavigationType,
} from './types'

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
  private committedNavigation: AbortController | undefined
  private controller: AbortController | undefined
  private currentIndex = 0
  private currentUrl = new URL(location.href)
  private documentStyles = new Set<string>()
  private hoverTimer = 0
  private mounted = false
  private navigationAbort: AbortController | undefined
  private readonly pageCache = new NavigationPageCache()
  private scrollFrame = 0
  private viewportObserver: IntersectionObserver | undefined
  private readonly viewportTimers = new Map<Element, number>()
  private readonly announcementTimers = new Set<number>()
  private activeTransition: ViewTransition | undefined
  private previousScrollRestoration: History['scrollRestoration'] | undefined

  constructor(private readonly prefetchPolicy: NavigationPrefetchPolicy) {}

  mount = () => {
    if (this.mounted) return
    this.mounted = true
    this.controller = new AbortController()
    this.currentUrl = new URL(location.href)
    this.documentStyles = initialDocumentStyles(new URL(document.baseURI))
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
    this.previousScrollRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    seedExecutedScripts()
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
    this.cancelHoverPrefetch()
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
    this.documentStyles.clear()
    document.querySelectorAll('[data-nib-navigation-preload]').forEach((node) => node.remove())
    document.documentElement.removeAttribute('data-nib-navigation-direction')
    document.documentElement.removeAttribute('data-nib-navigation-fallback')
    if (this.previousScrollRestoration !== undefined) {
      history.scrollRestoration = this.previousScrollRestoration
    }
    this.controller = undefined
    this.committedNavigation = undefined
    this.navigationAbort = undefined
    this.viewportObserver = undefined
    this.activeTransition = undefined
    this.hoverTimer = 0
    this.scrollFrame = 0
    this.previousScrollRestoration = undefined
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
    window.addEventListener(HISTORY_WRITE_EVENT, this.onHistoryWrite as EventListener, { signal })
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
    if (
      !link
      || prefetchMode(link, this.prefetchPolicy) !== 'hover'
    ) return
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
    this.cancelHoverPrefetch()
  }

  private cancelHoverPrefetch() {
    window.clearTimeout(this.hoverTimer)
    this.hoverTimer = 0
  }

  private onTouchPrefetch = (event: Event) => {
    const link = linkFromEvent(event)
    if (!link || prefetchMode(link, this.prefetchPolicy) !== 'tap') return
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
    const target = effectiveNavigationTarget(
      form,
      submitter?.getAttribute('formtarget') ?? null,
    )
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
    window.dispatchEvent(new HashChangeEvent('hashchange', {
      oldURL: from.href,
      newURL: to.href,
    }))
  }

  private onPopState = (event: PopStateEvent) => {
    const state = event.state as NavigationHistoryState | null
    const storedIndex = stateNumber(state, HISTORY_INDEX, Number.NaN)
    const hasIndex = Number.isFinite(storedIndex)
    const nextIndex = hasIndex
      ? storedIndex
      : Math.max(0, this.currentIndex - 1)
    const previousIndex = this.currentIndex
    const direction: NavigationDirection = nextIndex < previousIndex
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

    if (
      to.pathname === from.pathname
      && (
        to.search === from.search
        || nextIndex === previousIndex
      )
    ) {
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

  private onHistoryWrite = (event: CustomEvent<NavigationHistoryWriteDetail>) => {
    const detail = event.detail
    if (detail.handled) return
    this.snapshotScroll()
    history[detail.mode === 'push' ? 'pushState' : 'replaceState']({
      ...detail.state,
      [HISTORY_INDEX]: this.currentIndex,
      [HISTORY_SCROLL_X]: window.scrollX,
      [HISTORY_SCROLL_Y]: window.scrollY,
    }, '', detail.url)
    this.currentUrl = detail.url
    detail.handled = true
  }

  private hardNavigate(url: URL) {
    location.href = url.href
  }

  private async performNavigation(to: URL, context: NavigationContext) {
    this.cancelHoverPrefetch()
    if (this.committedNavigation) {
      this.committedNavigation.abort()
      this.hardNavigate(to)
      return
    }
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
    let fallbackUrl = to

    try {
      const cached = this.pageCache.get(to, signal)
      const prepared = await (
        cached ? abortable(cached, signal) : requestPage(to, signal)
      )
      if (signal.aborted) return
      if (!prepared) {
        this.hardNavigate(to)
        return
      }

      const finalUrl = new URL(prepared.finalUrl, to)
      finalUrl.hash = to.hash
      if (finalUrl.origin !== location.origin) {
        this.hardNavigate(finalUrl)
        return
      }
      fallbackUrl = finalUrl

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
      const currentBaseUrl = new URL(document.baseURI)
      const nextBaseUrl = prepareNavigationBase(nextDocument, finalUrl)
      absolutizeHeadResources(nextDocument, nextBaseUrl)
      if (runtimeEntryChanged(
        nextDocument,
        currentBaseUrl,
        nextBaseUrl,
      )) {
        this.hardNavigate(finalUrl)
        return
      }
      markPreviouslyExecutedScripts(
        currentScriptIdentities(currentBaseUrl),
        nextDocument,
        nextBaseUrl,
      )
      const pendingStyles = preloadNewStyles(
        nextDocument,
        currentBaseUrl,
        nextBaseUrl,
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
          currentBaseUrl,
          nextBaseUrl,
          context,
          signal,
          () => {
            this.committedNavigation = navigationAbort
          },
        )
      }
      const completeNavigation = async () => {
        await executeNewScripts(signal)
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
            document.documentElement.removeAttribute('data-nib-navigation-direction')
            document.documentElement.removeAttribute(
              'data-nib-navigation-fallback',
            )
          }
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
      this.hardNavigate(fallbackUrl)
    } finally {
      if (this.navigationAbort === navigationAbort) {
        this.navigationAbort = undefined
      }
      if (this.committedNavigation === navigationAbort) {
        this.committedNavigation = undefined
      }
    }
  }

  private async swapDocument(
    nextDocument: Document,
    from: URL,
    to: URL,
    currentBaseUrl: URL,
    nextBaseUrl: URL,
    context: NavigationContext,
    signal: AbortSignal,
    onCommit: () => void,
  ) {
    const currentRoot = document.getElementById('root')
    const nextRoot = nextDocument.getElementById('root')
    if (!(currentRoot instanceof HTMLElement) || !(nextRoot instanceof HTMLElement)) {
      throw new Error('Client navigation requires a #root element')
    }

    let restoreFocus: (() => void) | undefined
    let committed = false
    let defaultSwapCalled = false
    const commit = () => {
      if (committed) return
      committed = true
      this.commitHistory(to, context)
      document.head.querySelector(`base[${TRANSIENT_BASE_ATTRIBUTE}]`)?.remove()
      onCommit()
    }
    const defaultSwap = () => {
      if (defaultSwapCalled) return
      defaultSwapCalled = true
      activateNavigationBase(nextDocument)
      const clientStyles = new Set(
        [...stylesheetHrefs(document, currentBaseUrl)]
          .filter((href) => !this.documentStyles.has(href)),
      )
      syncHead(nextDocument, currentBaseUrl, nextBaseUrl, clientStyles)
      this.documentStyles = stylesheetHrefs(nextDocument, nextBaseUrl)
      copyAttributes(
        nextDocument.documentElement,
        document.documentElement,
        ['data-nib-navigation-direction', 'data-nib-navigation-fallback'],
      )
      copyAttributes(nextDocument.body, document.body)
      unmountClientRuntimes(currentRoot)
      restoreFocus = restorePersistedElements(currentRoot, nextRoot)
      currentRoot.replaceWith(nextRoot)
      commit()
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

    commit()
    restoreFocus?.()
    const handledHash = scrollToHash(to)
    if (restoreFocus === undefined && !handledHash) focusRouteContent()
    if (context.restoreScroll) {
      window.scrollTo({
        left: context.restoreScroll.x,
        top: context.restoreScroll.y,
        behavior: 'auto',
      })
    } else if (!handledHash) {
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
export function createClientNavigation(
  options: ClientNavigationOptions = {},
): ClientNavigationController {
  const prefetch = options.prefetch ?? 'hover'
  if (prefetch !== 'hover' && prefetch !== 'explicit') {
    throw new Error(`Unsupported Nib navigation prefetch policy: ${String(prefetch)}`)
  }
  return new NibClientNavigation(prefetch)
}

let startedController: ClientNavigationController | undefined

function startNavigation(options: ClientNavigationOptions): ClientNavigationController {
  if (startedController === undefined) {
    startedController = createClientNavigation(options)
  }
  startedController.mount()
  return startedController
}

/** Starts the generated plugin entry with compatibility hover prefetching. */
export function startClientNavigation(): ClientNavigationController {
  return startNavigation({ prefetch: 'hover' })
}

/** Starts the generated plugin entry with annotation-only prefetching. */
export function startExplicitClientNavigation(): ClientNavigationController {
  return startNavigation({ prefetch: 'explicit' })
}

/** Initializes navigation with the generated client-bootstrap lifetime. */
export function initializeClientNavigation(signal: AbortSignal): void {
  const controller = createClientNavigation({ prefetch: 'hover' })
  controller.mount()
  signal.addEventListener('abort', () => controller.destroy(), { once: true })
}

/** Initializes explicit-only navigation with the generated client-bootstrap lifetime. */
export function initializeExplicitClientNavigation(signal: AbortSignal): void {
  const controller = createClientNavigation({ prefetch: 'explicit' })
  controller.mount()
  signal.addEventListener('abort', () => controller.destroy(), { once: true })
}

/** Destroys the generated plugin-owned controller, primarily for HMR and tests. */
export function stopClientNavigation(): void {
  startedController?.destroy()
  startedController = undefined
}
