import type { FetchedPage } from './types'

interface CachedPageBase {
  createdAt: number
  key: string
  url: URL
}

interface QueuedPage extends CachedPageBase {
  kind: 'queued'
  signal: AbortSignal
}

interface StartedPage extends CachedPageBase {
  kind: 'started'
  controller: AbortController
  promise: Promise<FetchedPage | null>
}

type CachedPage = QueuedPage | StartedPage

interface NetworkInformationLike {
  effectiveType?: string
  saveData?: boolean
}

const CACHE_TTL_MS = 30_000
const MAX_CONCURRENT_PREFETCHES = 6
const MAX_PREFETCHED_PAGES = 40

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

export async function requestPage(
  url: URL,
  signal?: AbortSignal,
): Promise<FetchedPage | null> {
  try {
    const response = await fetch(normalizedFetchUrl(url), {
      credentials: 'same-origin',
      headers: {
        Accept: 'text/html, application/xhtml+xml',
      },
      method: 'GET',
      redirect: 'follow',
      ...(signal === undefined ? {} : { signal }),
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
    if (
      error !== null
      && typeof error === 'object'
      && 'name' in error
      && error.name === 'AbortError'
    ) {
      throw error
    }
    return null
  }
}

export class NavigationPageCache {
  private activePrefetches = 0
  private readonly pages = new Map<string, CachedPage>()
  private queue: QueuedPage[] = []

  clear() {
    for (const page of this.pages.values()) this.discard(page)
    this.pages.clear()
    this.queue = []
  }

  get(
    url: URL,
    navigationSignal: AbortSignal,
  ): Promise<FetchedPage | null> | undefined {
    const cached = this.cached(url)
    if (!cached) return undefined
    if (cached.kind === 'queued') {
      this.discard(cached)
      return requestPage(url, navigationSignal)
    }
    return cached.promise
  }

  prefetch(url: URL, signal: AbortSignal) {
    if (!canPrefetch() || isSlowConnection() || signal.aborted) return
    if (url.origin !== location.origin) return

    const key = normalizedFetchUrl(url)
    if (
      key === normalizedFetchUrl(new URL(location.href))
      || this.cached(url)
    ) return

    const page: QueuedPage = {
      createdAt: Date.now(),
      kind: 'queued',
      key,
      signal,
      url: new URL(url),
    }
    this.pages.set(key, page)
    this.queue.push(page)
    while (this.pages.size > MAX_PREFETCHED_PAGES) {
      const oldest = this.pages.keys().next().value
      if (typeof oldest !== 'string') break
      const evicted = this.pages.get(oldest)
      if (evicted) this.discard(evicted)
    }
    this.pump()
  }

  private cached(url: URL): CachedPage | undefined {
    const key = normalizedFetchUrl(url)
    const cached = this.pages.get(key)
    if (!cached) return undefined
    if (Date.now() - cached.createdAt > CACHE_TTL_MS) {
      this.discard(cached)
      return undefined
    }
    this.pages.delete(key)
    this.pages.set(key, cached)
    return cached
  }

  private discard(page: CachedPage) {
    if (this.pages.get(page.key) === page) this.pages.delete(page.key)
    if (page.kind === 'queued') {
      this.queue = this.queue.filter((candidate) => candidate !== page)
    } else {
      page.controller.abort()
    }
  }

  private pump() {
    while (this.activePrefetches < MAX_CONCURRENT_PREFETCHES) {
      const page = this.queue.shift()
      if (!page) return
      if (page.signal.aborted || this.pages.get(page.key) !== page) {
        this.discard(page)
        continue
      }
      this.start(page)
    }
  }

  private start(page: QueuedPage) {
    if (this.pages.get(page.key) !== page) return
    this.activePrefetches += 1

    const controller = new AbortController()
    const abort = () => controller.abort()
    if (page.signal.aborted) abort()
    else page.signal.addEventListener('abort', abort, { once: true })

    let started!: StartedPage
    const promise = requestPage(page.url, controller.signal).then(
      (result) => {
        if (!result && this.pages.get(page.key) === started) {
          this.pages.delete(page.key)
        }
        return result
      },
      (error: unknown) => {
        if (this.pages.get(page.key) === started) this.pages.delete(page.key)
        throw error
      },
    )
    started = {
      controller,
      createdAt: page.createdAt,
      key: page.key,
      kind: 'started',
      promise,
      url: page.url,
    }
    this.pages.set(page.key, started)
    void promise.catch(() => {
      // Background failures are retried as ordinary navigations when needed.
    }).finally(() => {
      page.signal.removeEventListener('abort', abort)
      this.activePrefetches -= 1
      this.pump()
    })
  }
}
