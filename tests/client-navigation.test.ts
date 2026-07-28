// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  mount: vi.fn(),
  unmount: vi.fn(),
}))

vi.mock('../src/runtime/coordinator', () => ({
  mountClientRuntimes: runtime.mount,
  unmountClientRuntimes: runtime.unmount,
}))

import {
  createClientNavigation,
  type ClientNavigationController,
  type NavigationBeforeSwapDetail,
  type NavigationLifecycleDetail,
} from '../src/client/navigation'

function page(
  pathname: string,
  title: string,
  body: string,
  head = '',
): Response {
  return {
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
    text: async () => `<!doctype html>
      <html lang="en">
        <head><title>${title}</title>${head}</head>
        <body><div id="root">${body}</div></body>
      </html>`,
    url: new URL(pathname, location.href).href,
  } as Response
}

function deferredResponse(signal?: AbortSignal) {
  let resolve!: (response: Response) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<Response>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  signal?.addEventListener('abort', () => {
    reject(new DOMException('Navigation aborted', 'AbortError'))
  }, { once: true })
  return { promise, resolve }
}

let controller: ClientNavigationController | undefined

beforeEach(() => {
  document.documentElement.innerHTML = `
    <head><title>Home</title></head>
    <body><div id="root"><h1>Home</h1></div></body>
  `
  history.replaceState(null, '', '/')
  history.scrollRestoration = 'auto'
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: undefined,
  })
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: undefined,
  })
  runtime.mount.mockReset()
  runtime.unmount.mockReset()
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn()
  }
})

afterEach(() => {
  controller?.destroy()
  controller = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('optional client navigation', () => {
  it('mounts idempotently and emits typed lifecycle events around one swap', async () => {
    vi.mocked(fetch).mockResolvedValue(page('/next?from=test', 'Next', '<h1>Next page</h1>'))
    const events: string[] = []
    let beforeDetail: NavigationBeforeSwapDetail | undefined
    let loadDetail: NavigationLifecycleDetail | undefined
    document.addEventListener('nib:navigation-before-swap', (event) => {
      events.push('before')
      beforeDetail = event.detail
    }, { once: true })
    document.addEventListener('nib:navigation-after-swap', () => {
      events.push('after')
    }, { once: true })
    document.addEventListener('nib:navigation-load', (event) => {
      events.push('load')
      loadDetail = event.detail
    }, { once: true })

    controller = createClientNavigation()
    controller.mount()
    const initialState = history.state
    controller.mount()
    expect(history.state).toEqual(initialState)

    await controller.navigate('/next?from=test')

    expect(document.title).toBe('Next')
    expect(document.querySelector('#root')?.textContent).toContain('Next page')
    expect(location.pathname).toBe('/next')
    expect(location.search).toBe('?from=test')
    expect(events).toEqual(['before', 'after', 'load'])
    expect(beforeDetail).toMatchObject({
      direction: 'forward',
      navigationType: 'push',
      to: expect.objectContaining({ pathname: '/next' }),
    })
    expect(loadDetail?.to.pathname).toBe('/next')
    expect(runtime.unmount).toHaveBeenCalledOnce()
    expect(runtime.mount).toHaveBeenCalledOnce()
    expect(document.documentElement.hasAttribute('data-nib-navigation-direction')).toBe(false)
    const announcer = document.querySelector<HTMLElement>('.nib-route-announcer')
    expect(announcer?.classList.contains('sr-only')).toBe(false)
    expect(announcer?.style.position).toBe('absolute')
    expect(announcer?.style.width).toBe('1px')
    expect(announcer?.getAttribute('aria-live')).toBe('assertive')
  })

  it('aborts a superseded request without letting stale HTML win', async () => {
    const requests = new Map<string, ReturnType<typeof deferredResponse>>()
    vi.mocked(fetch).mockImplementation((_input, init) => {
      const pathname = new URL(String(_input), location.href).pathname
      const request = deferredResponse(init?.signal ?? undefined)
      requests.set(pathname, request)
      return request.promise
    })
    controller = createClientNavigation()
    controller.mount()

    const first = controller.navigate('/first')
    const second = controller.navigate('/second')
    requests.get('/second')?.resolve(page('/second', 'Second', '<h1>Second</h1>'))
    await second
    await first

    expect(location.pathname).toBe('/second')
    expect(document.title).toBe('Second')
    expect(document.querySelector('#root')?.textContent).toBe('Second')
    expect(runtime.unmount).toHaveBeenCalledOnce()
    expect(runtime.mount).toHaveBeenCalledOnce()
  })

  it('settles a superseded navigation waiting on an active prefetch', async () => {
    document.querySelector('#root')!.innerHTML = Array.from(
      { length: 6 },
      (_, index) => `<a href="/active-${index}" data-nib-prefetch="load">${index}</a>`,
    ).join('')
    const requests = new Map<string, ReturnType<typeof deferredResponse>>()
    vi.mocked(fetch).mockImplementation((input, init) => {
      const pathname = new URL(String(input), location.href).pathname
      const request = deferredResponse(init?.signal ?? undefined)
      requests.set(pathname, request)
      return request.promise
    })
    controller = createClientNavigation()
    controller.mount()
    expect(fetch).toHaveBeenCalledTimes(6)

    const prefetched = controller.navigate('/active-0')
    const winner = controller.navigate('/winner')
    await vi.waitFor(() => expect(requests.has('/winner')).toBe(true))
    requests.get('/winner')?.resolve(page('/winner', 'Winner', '<h1>Winner</h1>'))

    await winner
    await prefetched
    expect(document.title).toBe('Winner')
    expect(location.pathname).toBe('/winner')
  })

  it('retains a persisted control, focus, and selection across documents', async () => {
    document.querySelector('#root')!.innerHTML = `
      <input data-nib-navigation-persist="search" value="preserved value">
      <a href="/results">Results</a>
    `
    const input = document.querySelector('input')!
    input.focus()
    input.setSelectionRange(2, 7)
    vi.mocked(fetch).mockResolvedValue(page(
      '/results',
      'Results',
      '<input data-nib-navigation-persist="search" value="replacement"><h1>Results</h1>',
    ))
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/results')

    expect(document.querySelector('input')).toBe(input)
    expect(input.value).toBe('preserved value')
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(2)
    expect(input.selectionEnd).toBe(7)
  })

  it('leaves modified, external, download, target, reload, and non-GET actions native', () => {
    document.querySelector('#root')!.innerHTML = `
      <a id="external" href="https://example.test/">External</a>
      <a id="download" href="/file" download>Download</a>
      <a id="target" href="/target" target="_blank">Target</a>
      <a id="reload" href="/reload" data-nib-navigation-reload>Reload</a>
      <a id="modified" href="/modified">Modified</a>
      <form id="post" action="/submit" method="post"><button>Submit</button></form>
    `
    controller = createClientNavigation()
    controller.mount()

    for (const id of ['external', 'download', 'target', 'reload']) {
      let preventedByController = true
      document.addEventListener('click', (nativeEvent) => {
        preventedByController = nativeEvent.defaultPrevented
        nativeEvent.preventDefault()
      }, { once: true })
      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      document.querySelector(`#${id}`)!.dispatchEvent(event)
      expect(preventedByController, id).toBe(false)
    }
    const modified = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    })
    document.querySelector('#modified')!.dispatchEvent(modified)
    expect(modified.defaultPrevented).toBe(false)

    const submit = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: document.querySelector('#post button'),
    })
    document.querySelector('#post')!.dispatchEvent(submit)
    expect(submit.defaultPrevented).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses a replace navigation without adding a history entry', async () => {
    vi.mocked(fetch).mockResolvedValue(page('/replacement', 'Replacement', '<h1>Replacement</h1>'))
    controller = createClientNavigation()
    controller.mount()
    const length = history.length

    await controller.navigate('/replacement', { history: 'replace' })

    expect(location.pathname).toBe('/replacement')
    expect(history.length).toBe(length)
    expect(history.state).toMatchObject({
      __nibNavigationIndex: 0,
      __nibScrollX: 0,
      __nibScrollY: 0,
    })
  })

  it('commits a same-origin redirect and keeps the requested hash', async () => {
    vi.mocked(fetch).mockResolvedValue(page(
      '/canonical/',
      'Canonical',
      '<h1 id="target">Canonical</h1>',
    ))
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {})
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/redirecting#target')

    expect(location.pathname).toBe('/canonical/')
    expect(location.hash).toBe('#target')
    expect(scrollIntoView).toHaveBeenCalledOnce()
  })

  it('activates the destination base before inserting relative resources', async () => {
    history.replaceState(null, '', '/recipes/current')
    vi.mocked(fetch).mockResolvedValue(page(
      '/next/subpage',
      'Next',
      '<h1>Next</h1><img src="./pixel.png" alt="">',
    ))
    const nativeReplaceWith = HTMLElement.prototype.replaceWith
    let baseDuringRootSwap: string | undefined
    vi.spyOn(HTMLElement.prototype, 'replaceWith').mockImplementation(function (
      this: HTMLElement,
      ...nodes: (Node | string)[]
    ) {
      if (this.id === 'root') baseDuringRootSwap = document.baseURI
      nativeReplaceWith.call(this, ...nodes)
    })
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/next/subpage')

    expect(new URL(baseDuringRootSwap!).pathname).toBe('/next/subpage')
    expect(document.querySelector<HTMLImageElement>('img')?.src)
      .toBe(new URL('/next/pixel.png', location.href).href)
    expect(document.querySelector(`base[data-nib-navigation-base]`)).toBeNull()
  })

  it('activates an authored base before earlier head resources are inserted', async () => {
    vi.mocked(fetch).mockResolvedValue(page(
      '/nested/page',
      'Nested',
      '<h1>Nested</h1>',
      '<script type="application/json" src="./metadata.json"></script><base href="../assets/">',
    ))
    const nativeReplaceWith = HTMLElement.prototype.replaceWith
    let baseDuringRootSwap: string | undefined
    vi.spyOn(HTMLElement.prototype, 'replaceWith').mockImplementation(function (
      this: HTMLElement,
      ...nodes: (Node | string)[]
    ) {
      if (this.id === 'root') baseDuringRootSwap = document.baseURI
      nativeReplaceWith.call(this, ...nodes)
    })
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/nested/page')

    expect(new URL(baseDuringRootSwap!).pathname).toBe('/assets/')
    expect(document.querySelector<HTMLScriptElement>('script[src]')?.src)
      .toBe(new URL('/assets/metadata.json', location.href).href)
    expect(document.querySelector(`base[data-nib-navigation-base]`)).toBeNull()
    expect(new URL(document.baseURI).pathname).toBe('/assets/')
  })

  it('falls back to native navigation for non-HTML and malformed documents', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{}',
        url: new URL('/non-html', location.href).href,
      } as Response)
      .mockResolvedValueOnce({
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html><head><title>Missing root</title></head><body></body></html>',
        url: new URL('/missing-root', location.href).href,
      } as Response)
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/non-html')
    expect(location.pathname).toBe('/non-html')

    history.replaceState(history.state, '', '/')
    await controller.navigate('/missing-root')
    expect(location.pathname).toBe('/missing-root')
    expect(runtime.unmount).not.toHaveBeenCalled()
  })

  it('rejects duplicate persistence keys before detaching the current root', async () => {
    vi.mocked(fetch).mockResolvedValue(page(
      '/duplicate',
      'Duplicate',
      `<div data-nib-navigation-persist="same"></div>
       <div data-nib-navigation-persist="same"></div>`,
    ))
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/duplicate')

    expect(location.pathname).toBe('/duplicate')
    expect(document.title).toBe('Home')
    expect(runtime.unmount).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith(
      '[nib-navigation] Navigation failed',
      expect.objectContaining({ message: expect.stringContaining('duplicate persistence key') }),
    )
  })

  it('preserves head order and CSP attributes while honoring explicit script reruns', async () => {
    document.head.innerHTML = `
      <title>Home</title>
      <meta name="first" content="old">
      <script nonce="abc" data-nib-script-rerun>window.__rerun = true</script>
    `
    const originalScript = document.querySelector('script')
    vi.mocked(fetch).mockResolvedValue(page(
      '/head',
      'Head',
      '<h1>Head</h1>',
      `<meta name="first" content="new">
       <meta name="second" content="yes">
       <script nonce="abc" data-nib-script-rerun>window.__rerun = true</script>
       <script type="application/ld+json" nonce="json">{"ok":true}</script>`,
    ))
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/head')

    expect([...document.head.children].map((element) => (
      element instanceof HTMLMetaElement
        ? element.getAttribute('name')
        : element.localName
    ))).toEqual(['title', 'first', 'second', 'script', 'script'])
    const scripts = [...document.head.querySelectorAll('script')]
    expect(scripts[0]).not.toBe(originalScript)
    expect(scripts[0]?.getAttribute('nonce')).toBe('abc')
    expect(scripts[0]?.hasAttribute('data-nib-script-executed')).toBe(true)
    expect(scripts[1]?.type).toBe('application/ld+json')
    expect(scripts[1]?.getAttribute('nonce')).toBe('json')
  })

  it('replaces matching head resources when their other attributes change', async () => {
    document.head.innerHTML = `
      <title>Home</title>
      <link rel="stylesheet" href="data:text/css,body{}" media="screen" integrity="old">
      <style media="screen">body { color: black; }</style>
      <script type="application/json" src="data:application/json,{}" nonce="old" data-version="1"></script>
    `
    const previous = {
      link: document.querySelector('link'),
      script: document.querySelector('script'),
      style: document.querySelector('style'),
    }
    vi.mocked(fetch).mockResolvedValue(page(
      '/head-attributes',
      'Head attributes',
      '<h1>Head attributes</h1>',
      `<link rel="stylesheet" href="data:text/css,body{}" media="print" integrity="new" crossorigin="anonymous">
       <style media="print">body { color: black; }</style>
       <script type="application/json" src="data:application/json,{}" nonce="new" data-version="2"></script>`,
    ))
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/head-attributes')

    const link = document.querySelector('link')
    const style = document.querySelector('style')
    const script = document.querySelector('script')
    expect(link).not.toBe(previous.link)
    expect(style).not.toBe(previous.style)
    expect(script).not.toBe(previous.script)
    expect(link).toMatchObject({ media: 'print' })
    expect(link?.getAttribute('integrity')).toBe('new')
    expect(link?.getAttribute('crossorigin')).toBe('anonymous')
    expect(style?.getAttribute('media')).toBe('print')
    expect(script?.getAttribute('nonce')).toBe('new')
    expect(script?.getAttribute('data-version')).toBe('2')
  })

  it('deduplicates scripts against the current document rather than session history', async () => {
    document.head.innerHTML = `
      <title>Home</title>
      <script>window.__pageScript = true</script>
    `
    vi.mocked(fetch)
      .mockResolvedValueOnce(page('/without-script', 'Without script', '<h1>Without</h1>'))
      .mockResolvedValueOnce(page(
        '/script-returns',
        'Script returns',
        '<h1>Returns</h1>',
        '<script>window.__pageScript = true</script>',
      ))
    controller = createClientNavigation()
    controller.mount()
    await controller.navigate('/without-script')

    let wasMarkedAsExecuted: boolean | undefined
    document.addEventListener('nib:navigation-before-swap', (event) => {
      wasMarkedAsExecuted = event.detail.newDocument
        .querySelector('script')
        ?.hasAttribute('data-nib-script-executed')
    }, { once: true })
    await controller.navigate('/script-returns')

    expect(wasMarkedAsExecuted).toBe(false)
  })

  it('hard-navigates when a retained Nib runtime entry changes deployment hash', async () => {
    document.head.innerHTML = `
      <title>Home</title>
      <script data-nib-islands type="application/json" src="/assets/islands-old.js"></script>
    `
    vi.mocked(fetch)
      .mockResolvedValueOnce(page('/static', 'Static', '<h1>Static</h1>'))
      .mockResolvedValueOnce(page(
        '/new-deployment',
        'New deployment',
        '<h1>New</h1>',
        '<script data-nib-islands type="application/json" src="/assets/islands-new.js"></script>',
      ))
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/static')
    expect(document.querySelector('script[data-nib-islands]')?.getAttribute('src'))
      .toBe('/assets/islands-old.js')
    const unmountCalls = runtime.unmount.mock.calls.length

    await controller.navigate('/new-deployment')

    expect(location.pathname).toBe('/new-deployment')
    expect(document.title).toBe('Static')
    expect(runtime.unmount).toHaveBeenCalledTimes(unmountCalls)
  })

  it('preserves client CSS that loaded before navigation mounted', async () => {
    document.head.innerHTML = `
      <title>Home</title>
      <link rel="stylesheet" href="data:text/css,server">
      <script data-nib-enhancements type="application/json" src="/assets/enhancements.js"></script>
      <link rel="stylesheet" href="data:text/css,lazy-client">
    `
    vi.mocked(fetch).mockResolvedValue(page(
      '/next',
      'Next',
      '<h1>Next</h1>',
      `<link rel="stylesheet" href="data:text/css,server">
       <script data-nib-enhancements type="application/json" src="/assets/enhancements.js"></script>`,
    ))
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/next')

    expect([
      ...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    ].map((link) => link.href)).toEqual([
      'data:text/css,server',
      'data:text/css,lazy-client',
    ])
  })

  it('commits the default swap atomically before an async swap extension yields', async () => {
    vi.mocked(fetch).mockResolvedValue(page('/first', 'First', '<h1>First</h1>'))
    let release!: () => void
    const extensionWork = new Promise<void>((resolve) => {
      release = resolve
    })
    document.addEventListener('nib:navigation-before-swap', (event) => {
      const defaultSwap = event.detail.swap
      event.detail.swap = async () => {
        await defaultSwap()
        await extensionWork
      }
    }, { once: true })
    controller = createClientNavigation()
    controller.mount()

    const first = controller.navigate('/first')
    await vi.waitFor(() => expect(document.title).toBe('First'))
    expect(location.pathname).toBe('/first')
    expect(document.querySelector(`base[data-nib-navigation-base]`)).toBeNull()

    await controller.navigate('/second')
    expect(fetch).toHaveBeenCalledOnce()
    expect(location.pathname).toBe('/second')

    release()
    await first
    expect(runtime.mount).not.toHaveBeenCalled()
  })

  it('prefetches load links within a bounded cache and skips constrained connections', async () => {
    document.querySelector('#root')!.innerHTML = Array.from(
      { length: 41 },
      (_, index) => `<a href="/prefetch-${index}" data-nib-prefetch="load">${index}</a>`,
    ).join('')
    vi.mocked(fetch).mockImplementation((input) => {
      const url = new URL(String(input), location.href)
      return Promise.resolve(page(url.pathname, url.pathname, `<h1>${url.pathname}</h1>`))
    })
    controller = createClientNavigation()
    controller.mount()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(41))

    await controller.navigate('/prefetch-40')
    expect(fetch).toHaveBeenCalledTimes(41)
    history.replaceState(history.state, '', '/')
    await controller.navigate('/prefetch-0')
    expect(fetch).toHaveBeenCalledTimes(42)

    controller.destroy()
    vi.mocked(fetch).mockClear()
    document.querySelector('#root')!.innerHTML =
      '<a href="/slow" data-nib-prefetch="load">Slow</a>'
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true },
    })
    controller.mount()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('caps background prefetches and immediately promotes a clicked queued page', async () => {
    document.querySelector('#root')!.innerHTML = Array.from(
      { length: 41 },
      (_, index) => `<a href="/queued-${index}" data-nib-prefetch="load">${index}</a>`,
    ).join('')
    const requests = new Map<string, ReturnType<typeof deferredResponse>>()
    vi.mocked(fetch).mockImplementation((input, init) => {
      const pathname = new URL(String(input), location.href).pathname
      const request = deferredResponse(init?.signal ?? undefined)
      requests.set(pathname, request)
      return request.promise
    })
    controller = createClientNavigation()
    controller.mount()

    expect(fetch).toHaveBeenCalledTimes(6)
    expect(requests.has('/queued-40')).toBe(false)

    const promoted = controller.navigate('/queued-40')
    await vi.waitFor(() => expect(requests.has('/queued-40')).toBe(true))
    expect(fetch).toHaveBeenCalledTimes(7)

    const superseding = controller.navigate('/foreground')
    await vi.waitFor(() => expect(requests.has('/foreground')).toBe(true))
    requests.get('/foreground')?.resolve(page(
      '/foreground',
      'Foreground',
      '<h1>Foreground</h1>',
    ))
    await superseding
    await promoted

    expect(document.title).toBe('Foreground')
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThan(41)
  })

  it('restarts a promoted queued request when same-page navigation supersedes it', async () => {
    document.querySelector('#root')!.innerHTML = Array.from(
      { length: 7 },
      (_, index) => `<a href="/same-${index}" data-nib-prefetch="load">${index}</a>`,
    ).join('')
    const requests = new Map<string, ReturnType<typeof deferredResponse>[]>()
    vi.mocked(fetch).mockImplementation((input, init) => {
      const pathname = new URL(String(input), location.href).pathname
      const request = deferredResponse(init?.signal ?? undefined)
      const pending = requests.get(pathname) ?? []
      pending.push(request)
      requests.set(pathname, pending)
      return request.promise
    })
    controller = createClientNavigation()
    controller.mount()
    expect(fetch).toHaveBeenCalledTimes(6)

    const first = controller.navigate('/same-6')
    await vi.waitFor(() => expect(requests.get('/same-6')).toHaveLength(1))
    const second = controller.navigate('/same-6')
    await vi.waitFor(() => expect(requests.get('/same-6')).toHaveLength(2))
    requests.get('/same-6')?.[1]?.resolve(page(
      '/same-6',
      'Same page',
      '<h1>Same page</h1>',
    ))

    await second
    await first
    expect(document.title).toBe('Same page')
    expect(location.pathname).toBe('/same-6')
  })

  it('keeps background queue drain at six and never starts queued work on destroy', async () => {
    document.querySelector('#root')!.innerHTML = Array.from(
      { length: 12 },
      (_, index) => `<a href="/drain-${index}" data-nib-prefetch="load">${index}</a>`,
    ).join('')
    const requests = new Map<string, ReturnType<typeof deferredResponse>>()
    let active = 0
    let peak = 0
    vi.mocked(fetch).mockImplementation((input, init) => {
      const pathname = new URL(String(input), location.href).pathname
      const request = deferredResponse(init?.signal ?? undefined)
      requests.set(pathname, request)
      active += 1
      peak = Math.max(peak, active)
      return request.promise.finally(() => {
        active -= 1
      })
    })
    controller = createClientNavigation()
    controller.mount()

    expect(fetch).toHaveBeenCalledTimes(6)
    expect(active).toBe(6)
    expect(peak).toBe(6)

    requests.get('/drain-0')?.resolve(page('/drain-0', 'Zero', '<h1>Zero</h1>'))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(7))
    expect(active).toBe(6)
    expect(peak).toBe(6)

    const callsBeforeDestroy = vi.mocked(fetch).mock.calls.length
    controller.destroy()
    controller = undefined
    await vi.waitFor(() => expect(active).toBe(0))
    expect(fetch).toHaveBeenCalledTimes(callsBeforeDestroy)
  })

  it('requires an explicit tap strategy for pointer-down prefetch', async () => {
    document.querySelector('#root')!.innerHTML = `
      <a id="ordinary" href="/ordinary">Ordinary</a>
      <a id="tap" href="/tap" data-nib-prefetch="tap">Tap</a>
    `
    vi.mocked(fetch).mockImplementation((input) => {
      const url = new URL(String(input), location.href)
      return Promise.resolve(page(url.pathname, url.pathname, `<h1>${url.pathname}</h1>`))
    })
    controller = createClientNavigation()
    controller.mount()

    document.querySelector('#ordinary')!.dispatchEvent(new Event('touchstart', {
      bubbles: true,
    }))
    expect(fetch).not.toHaveBeenCalled()

    document.querySelector('#tap')!.dispatchEvent(new Event('touchstart', {
      bubbles: true,
    }))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/tap'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('serializes same-origin GET forms but leaves their content server-renderable', async () => {
    document.querySelector('#root')!.innerHTML = `
      <form action="/results/" method="get">
        <input name="q" value="nib navigation">
        <button name="scope" value="docs">Search</button>
      </form>
    `
    vi.mocked(fetch).mockResolvedValue(page(
      '/results/?q=nib+navigation&scope=docs',
      'Results',
      '<h1>Results</h1>',
    ))
    controller = createClientNavigation()
    controller.mount()

    const button = document.querySelector('button')!
    const submit = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: button,
    })
    document.querySelector('form')!.dispatchEvent(submit)
    await vi.waitFor(() => expect(document.title).toBe('Results'))

    expect(submit.defaultPrevented).toBe(true)
    expect(location.pathname).toBe('/results/')
    expect(location.search).toBe('?q=nib+navigation&scope=docs')
  })

  it('disconnects viewport prefetch observers and cancels their pending timers', () => {
    vi.useFakeTimers()
    document.querySelector('#root')!.innerHTML =
      '<a href="/viewport" data-nib-prefetch="viewport">Viewport</a>'
    let callback!: IntersectionObserverCallback
    const disconnect = vi.fn()
    const observe = vi.fn()
    const unobserve = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(nextCallback: IntersectionObserverCallback) {
        callback = nextCallback
      }

      disconnect = disconnect
      observe = observe
      unobserve = unobserve
    })
    controller = createClientNavigation()
    controller.mount()
    const target = document.querySelector('a')!
    callback(
      [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
      { unobserve } as unknown as IntersectionObserver,
    )

    controller.destroy()
    vi.advanceTimersByTime(500)

    expect(observe).toHaveBeenCalledWith(target)
    expect(disconnect).toHaveBeenCalledOnce()
    expect(unobserve).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('runs the same lifecycle through a view transition and cleans up an active transition', async () => {
    vi.mocked(fetch).mockResolvedValue(page('/transition', 'Transition', '<h1>Transition</h1>'))
    const skipTransition = vi.fn()
    let finishTransition!: () => void
    const finished = new Promise<void>((resolve) => {
      finishTransition = resolve
    })
    const startViewTransition = vi.fn((update: () => void | Promise<void>) => {
      const updateCallbackDone = Promise.resolve().then(update)
      return {
        ready: Promise.resolve(),
        updateCallbackDone,
        finished,
        skipTransition,
        types: new Set<string>(),
      } as unknown as ViewTransition
    })
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    })
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/transition')
    await Promise.resolve()

    expect(startViewTransition).toHaveBeenCalledOnce()
    expect(document.title).toBe('Transition')
    expect(runtime.unmount).toHaveBeenCalledOnce()
    expect(runtime.mount).toHaveBeenCalledOnce()
    controller.destroy()
    expect(skipTransition).toHaveBeenCalledOnce()
    finishTransition()
  })

  it('hard-navigates when a view-transition update rejects before swapping', async () => {
    vi.mocked(fetch).mockResolvedValue(page(
      '/transition-failure',
      'Transition failure',
      '<h1>Transition failure</h1>',
    ))
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: vi.fn(() => ({
        ready: Promise.resolve(),
        updateCallbackDone: Promise.reject(new Error('transition update failed')),
        finished: Promise.resolve(),
        skipTransition: vi.fn(),
        types: new Set<string>(),
      } as unknown as ViewTransition)),
    })
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/transition-failure')

    expect(location.pathname).toBe('/transition-failure')
    expect(document.title).toBe('Home')
    expect(runtime.unmount).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith(
      '[nib-navigation] Navigation failed',
      expect.objectContaining({ message: 'transition update failed' }),
    )
  })

  it('restores traversal direction and saved scroll without pushing history', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = new URL(String(input), location.href)
      return Promise.resolve(page(url.pathname, url.pathname, `<h1>${url.pathname}</h1>`))
    })
    const directions: string[] = []
    document.addEventListener('nib:navigation-after-swap', (event) => {
      directions.push(event.detail.direction)
    })
    controller = createClientNavigation()
    controller.mount()
    await controller.navigate('/one')
    await controller.navigate('/two')
    const historyLength = history.length

    history.replaceState({
      __nibNavigationIndex: 1,
      __nibScrollX: 12,
      __nibScrollY: 34,
    }, '', '/one')
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
    await vi.waitFor(() => expect(document.title).toBe('/one'))

    expect(directions.at(-1)).toBe('back')
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      left: 12,
      top: 34,
      behavior: 'auto',
    })
    expect(history.length).toBe(historyLength)
  })

  it('preloads new styles with security attributes and falls back on a load error', async () => {
    const appendedPreloads: HTMLLinkElement[] = []
    const originalAppend = document.head.append.bind(document.head)
    vi.spyOn(document.head, 'append').mockImplementation((...nodes: (Node | string)[]) => {
      for (const node of nodes) {
        if (node instanceof HTMLLinkElement && node.rel === 'preload') {
          appendedPreloads.push(node)
          queueMicrotask(() => node.dispatchEvent(new Event('load')))
        } else {
          originalAppend(node)
        }
      }
    })
    vi.mocked(fetch).mockResolvedValue(page(
      '/styled',
      'Styled',
      '<h1>Styled</h1>',
      '<link rel="stylesheet" href="data:text/css,body{}" integrity="sha256-test" crossorigin="anonymous">',
    ))
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/styled')

    expect(appendedPreloads).toHaveLength(1)
    expect(appendedPreloads[0]?.getAttribute('integrity')).toBe('sha256-test')
    expect(appendedPreloads[0]?.getAttribute('crossorigin')).toBe('anonymous')
    expect(document.querySelector('link[rel="stylesheet"]')?.getAttribute('href'))
      .toBe('data:text/css,body{}')

    history.replaceState(history.state, '', '/styled')
    document.title = 'Styled'
    vi.mocked(document.head.append).mockImplementation((...nodes: (Node | string)[]) => {
      for (const node of nodes) {
        if (node instanceof HTMLLinkElement && node.rel === 'preload') {
          queueMicrotask(() => node.dispatchEvent(new Event('error')))
        } else {
          originalAppend(node)
        }
      }
    })
    vi.mocked(fetch).mockResolvedValue(page(
      '/broken-style',
      'Broken',
      '<h1>Broken</h1>',
      '<link rel="stylesheet" href="data:text/css,broken">',
    ))
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})

    await controller.navigate('/broken-style')

    expect(location.pathname).toBe('/broken-style')
    expect(document.title).toBe('Styled')
    expect(report).toHaveBeenCalledWith(
      '[nib-navigation] Navigation failed',
      expect.objectContaining({ message: expect.stringContaining('Failed to preload') }),
    )
  })

  it('destroys active listeners so a later click remains native', () => {
    document.querySelector('#root')!.innerHTML = '<a id="next" href="/next">Next</a>'
    controller = createClientNavigation()
    controller.mount()
    controller.destroy()

    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.querySelector('#next')!.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('restores the prior browser scroll restoration mode on destroy', () => {
    history.scrollRestoration = 'auto'
    controller = createClientNavigation()
    controller.mount()
    expect(history.scrollRestoration).toBe('manual')

    controller.destroy()
    expect(history.scrollRestoration).toBe('auto')
  })

  it('supports annotation-only prefetch without changing navigation fallback', async () => {
    vi.useFakeTimers()
    document.querySelector('#root')!.innerHTML = `
      <a id="ordinary" href="/ordinary">Ordinary</a>
      <a id="hover" href="/hover" data-nib-prefetch="hover">Hover</a>
    `
    vi.mocked(fetch).mockImplementation((input) => {
      const url = new URL(String(input), location.href)
      return Promise.resolve(page(url.pathname, url.pathname, `<h1>${url.pathname}</h1>`))
    })
    controller = createClientNavigation({ prefetch: 'explicit' })
    controller.mount()

    document.querySelector('#ordinary')!.dispatchEvent(new Event('mouseover', { bubbles: true }))
    vi.advanceTimersByTime(100)
    expect(fetch).not.toHaveBeenCalled()

    document.querySelector('#hover')!.dispatchEvent(new Event('mouseover', { bubbles: true }))
    vi.advanceTimersByTime(100)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  })

  it('cancels pending hover prefetch when the link is clicked', async () => {
    vi.useFakeTimers()
    document.querySelector('#root')!.innerHTML =
      '<a href="/hover-click" data-nib-prefetch="hover">Hover then click</a>'
    vi.mocked(fetch).mockResolvedValue(page(
      '/hover-click',
      'Hover click',
      '<h1>Hover click</h1>',
    ))
    controller = createClientNavigation()
    controller.mount()

    const link = document.querySelector('a')!
    link.dispatchEvent(new Event('mouseover', { bubbles: true }))
    link.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
    }))
    expect(fetch).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(100)

    expect(fetch).toHaveBeenCalledOnce()
    expect(document.title).toBe('Hover click')
  })

  it('hard-navigates after runtime teardown fails', async () => {
    vi.mocked(fetch).mockResolvedValue(page(
      '/cleanup-failure',
      'Cleanup failure',
      '<h1>Cleanup failure</h1>',
    ))
    runtime.unmount.mockImplementationOnce(() => {
      throw new AggregateError([new Error('runtime failed')])
    })
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/cleanup-failure')

    expect(location.pathname).toBe('/cleanup-failure')
    expect(report).toHaveBeenCalledWith(
      '[nib-navigation] Navigation failed',
      expect.any(AggregateError),
    )
  })

  it('hard-navigates to a cross-origin redirect without swapping fetched HTML', async () => {
    vi.mocked(fetch).mockResolvedValue({
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => '<html><head><title>External</title></head><body><div id="root">External</div></body></html>',
      url: 'https://external.test/final',
    } as Response)
    controller = createClientNavigation()
    controller.mount()

    await controller.navigate('/redirect')

    expect(location.href).toBe('https://external.test/final')
    expect(document.title).toBe('Home')
    expect(runtime.unmount).not.toHaveBeenCalled()
  })
})
