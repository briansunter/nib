import type { FetchedPage } from './types'

interface CachedPage {
  createdAt: number
  promise: Promise<FetchedPage | null>
}

interface NetworkInformationLike {
  effectiveType?: string
  saveData?: boolean
}

const CACHE_TTL_MS = 30_000
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
  private readonly pages = new Map<string, CachedPage>()

  clear() {
    this.pages.clear()
  }

  get(url: URL): Promise<FetchedPage | null> | undefined {
    const key = normalizedFetchUrl(url)
    const cached = this.pages.get(key)
    if (!cached) return undefined
    if (Date.now() - cached.createdAt > CACHE_TTL_MS) {
      this.pages.delete(key)
      return undefined
    }
    this.pages.delete(key)
    this.pages.set(key, cached)
    return cached.promise
  }

  prefetch(url: URL, signal: AbortSignal) {
    if (!canPrefetch() || isSlowConnection() || signal.aborted) return
    if (url.origin !== location.origin) return

    const key = normalizedFetchUrl(url)
    if (key === normalizedFetchUrl(new URL(location.href)) || this.get(url)) return

    const promise = requestPage(url, signal)
    this.pages.set(key, { createdAt: Date.now(), promise })
    while (this.pages.size > MAX_PREFETCHED_PAGES) {
      const oldest = this.pages.keys().next().value
      if (typeof oldest !== 'string') break
      this.pages.delete(oldest)
    }
    void promise.then((page) => {
      if (!page) this.pages.delete(key)
    }).catch(() => {
      this.pages.delete(key)
    })
  }
}

export function connectionIsSlow(): boolean {
  return isSlowConnection()
}
