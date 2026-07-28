interface PagefindUIInstance {
  destroy(): void
}

interface PagefindUIOptions {
  element: HTMLElement
  bundlePath: string
  showImages: boolean
  showSubResults: boolean
  debounceTimeoutMs: number
}

declare global {
  interface Window {
    PagefindUI?: new (options: PagefindUIOptions) => PagefindUIInstance
    __personalSitePagefindScript?: Promise<void>
  }
}

function cleanResultUrl(raw: string): string {
  const url = new URL(raw, window.location.origin)
  url.pathname = url.pathname
    .replace(/\/index\.html$/, '/')
    .replace(/\.html$/, '')
  return `${url.pathname}${url.search}${url.hash}`
}

function loadPagefindUI(): Promise<void> {
  if (window.PagefindUI) return Promise.resolve()
  if (window.__personalSitePagefindScript) return window.__personalSitePagefindScript

  window.__personalSitePagefindScript = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-personal-site-pagefind]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Unable to load Pagefind UI')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = '/pagefind/pagefind-ui.js'
    script.async = true
    script.dataset.personalSitePagefind = ''
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('Unable to load Pagefind UI')), {
      once: true,
    })
    document.head.append(script)
  })

  return window.__personalSitePagefindScript
}

export function initSearch(root: HTMLElement, signal: AbortSignal): () => void {
  const container = root.querySelector<HTMLElement>('[data-pagefind-ui]')
  if (!container) return () => {}

  let instance: PagefindUIInstance | undefined
  let observer: MutationObserver | undefined
  let input: HTMLInputElement | null = null
  let inputRetryTimer = 0
  let queryTimer = 0
  let disposed = false
  const emptyState = document.querySelector<HTMLElement>('[data-search-empty-state]')

  const updateEmptyState = (query: string) => {
    const hasQuery = Boolean(query.trim())
    if (!emptyState) return
    emptyState.hidden = hasQuery
    if (hasQuery) {
      emptyState.setAttribute('aria-hidden', 'true')
      emptyState.setAttribute('inert', '')
    } else {
      emptyState.removeAttribute('aria-hidden')
      emptyState.removeAttribute('inert')
    }
  }

  const enhanceResults = () => {
    container
      .querySelectorAll<HTMLAnchorElement>('.pagefind-ui__result-link')
      .forEach((link) => {
        link.href = cleanResultUrl(link.getAttribute('href') ?? link.href)
        link.dataset.nibPrefetch = 'hover'
      })
  }

  const bindInput = (attempt = 0) => {
    if (disposed) return
    input = container.querySelector<HTMLInputElement>('.pagefind-ui__search-input')
    if (!input) {
      if (attempt < 50) {
        inputRetryTimer = window.setTimeout(() => bindInput(attempt + 1), 100)
      }
      return
    }

    const applyQuery = (query: string, dispatch = false) => {
      if (!input) return
      input.value = query
      updateEmptyState(query)
      if (dispatch) input.dispatchEvent(new Event('input', { bubbles: true }))
    }

    const initialQuery = new URLSearchParams(window.location.search).get('q') ?? ''
    applyQuery(initialQuery, Boolean(initialQuery))
    input.addEventListener('input', () => {
      const query = input?.value.trim() ?? ''
      updateEmptyState(query)
      window.clearTimeout(queryTimer)
      queryTimer = window.setTimeout(() => {
        const url = new URL(window.location.href)
        if (query) url.searchParams.set('q', query)
        else url.searchParams.delete('q')
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      }, 150)
    }, { signal })
    window.addEventListener('popstate', () => {
      const query = new URLSearchParams(window.location.search).get('q') ?? ''
      applyQuery(query, true)
    }, { signal })
    observer = new MutationObserver(enhanceResults)
    observer.observe(container, { childList: true, subtree: true })
    enhanceResults()
  }

  document.addEventListener('error', (event) => {
    const target = event.target as HTMLElement
    if (target?.classList?.contains('pagefind-ui__result-image')) {
      target.style.display = 'none'
    }
  }, { capture: true, signal })

  void loadPagefindUI().then(() => {
    if (disposed || !window.PagefindUI) return
    instance = new window.PagefindUI({
      element: container,
      bundlePath: '/pagefind/',
      showImages: true,
      showSubResults: true,
      debounceTimeoutMs: 150,
    })
    bindInput()
  }).catch(() => {
    // The generated Pagefind bundle exists after a production build.
  })

  return () => {
    disposed = true
    observer?.disconnect()
    instance?.destroy()
    window.clearTimeout(inputRetryTimer)
    window.clearTimeout(queryTimer)
  }
}
