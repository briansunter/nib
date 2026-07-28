import { PERSIST_ATTRIBUTE } from './persistence'

const EXECUTED_SCRIPT_ATTRIBUTE = 'data-nib-script-executed'
const RERUN_SCRIPT_ATTRIBUTE = 'data-nib-script-rerun'
export const TRANSIENT_BASE_ATTRIBUTE = 'data-nib-navigation-base'
const RUNTIME_SCRIPT_ATTRIBUTES = [
  'data-nib-islands',
  'data-nib-behaviors',
  'data-nib-enhancements',
] as const
const RUNTIME_SCRIPT_SELECTOR = RUNTIME_SCRIPT_ATTRIBUTES
  .map((attribute) => `script[${attribute}][src]`)
  .join(',')

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

export function seedExecutedScripts(): void {
  for (const script of document.scripts) {
    if (!scriptTypeIsExecutable(script)) continue
    script.setAttribute(EXECUTED_SCRIPT_ATTRIBUTE, '')
  }
}

export function currentScriptIdentities(baseUrl: URL): Set<string> {
  return new Set(
    [...document.scripts]
      .filter(scriptTypeIsExecutable)
      .map((script) => scriptIdentity(script, baseUrl)),
  )
}

export function markPreviouslyExecutedScripts(
  currentScripts: ReadonlySet<string>,
  nextDocument: Document,
  nextUrl: URL,
): void {
  for (const script of nextDocument.scripts) {
    if (!scriptTypeIsExecutable(script)) continue
    const identity = scriptIdentity(script, nextUrl)
    if (
      !script.hasAttribute(RERUN_SCRIPT_ATTRIBUTE)
      && currentScripts.has(identity)
    ) {
      script.setAttribute(EXECUTED_SCRIPT_ATTRIBUTE, '')
    }
  }
}

export async function executeNewScripts(signal: AbortSignal): Promise<void> {
  for (const script of [...document.scripts]) {
    if (signal.aborted) return
    if (
      script.getAttribute(EXECUTED_SCRIPT_ATTRIBUTE) === ''
      || !scriptTypeIsExecutable(script)
    ) {
      continue
    }

    const replacement = document.createElement('script')
    for (const attribute of script.attributes) {
      replacement.setAttribute(attribute.name, attribute.value)
    }
    replacement.textContent = script.textContent
    replacement.setAttribute(EXECUTED_SCRIPT_ATTRIBUTE, '')

    const source = replacement.getAttribute('src')
    const waitsForLoad = source !== null || replacement.type === 'module'
    const loaded = waitsForLoad
      ? new Promise<void>((resolve, reject) => {
          replacement.addEventListener('load', () => resolve(), { once: true })
          replacement.addEventListener(
            'error',
            () => reject(new Error(
              `Failed to execute navigation script ${source ?? 'inline module'}`,
            )),
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

export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('Navigation aborted', 'AbortError'))
  }
  return new Promise<T>((resolve, reject) => {
    const aborted = () => {
      reject(new DOMException('Navigation aborted', 'AbortError'))
    }
    signal.addEventListener('abort', aborted, { once: true })
    void promise.then(
      (value) => {
        signal.removeEventListener('abort', aborted)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', aborted)
        reject(error)
      },
    )
  })
}

function runtimeSources(
  root: ParentNode,
  attribute: typeof RUNTIME_SCRIPT_ATTRIBUTES[number],
  baseUrl: URL,
): string[] {
  return [...root.querySelectorAll<HTMLScriptElement>(`script[${attribute}][src]`)]
    .map((script) => resolvedAttribute(script, 'src', baseUrl))
    .sort()
}

export function runtimeEntryChanged(
  nextDocument: Document,
  currentUrl: URL,
  nextUrl: URL,
): boolean {
  return RUNTIME_SCRIPT_ATTRIBUTES.some((attribute) => {
    const current = runtimeSources(document, attribute, currentUrl)
    const next = runtimeSources(nextDocument, attribute, nextUrl)
    return current.length > 0
      && next.length > 0
      && (
        current.length !== next.length
        || current.some((source, index) => source !== next[index])
      )
  })
}

export function prepareNavigationBase(nextDocument: Document, nextUrl: URL): URL {
  const authoredBase = nextDocument.head.querySelector<HTMLBaseElement>('base[href]')
  let effectiveBase = nextUrl
  if (authoredBase) {
    try {
      const resolved = new URL(authoredBase.getAttribute('href') ?? '', nextUrl)
      authoredBase.href = resolved.href
      effectiveBase = resolved
    } catch {
      // Browsers ignore unusable authored bases and fall back to the document URL.
    }
  }

  const transientBase = nextDocument.createElement('base')
  transientBase.href = effectiveBase.href
  transientBase.setAttribute(TRANSIENT_BASE_ATTRIBUTE, '')
  nextDocument.head.prepend(transientBase)
  return effectiveBase
}

export function activateNavigationBase(nextDocument: Document): void {
  const base = nextDocument.head.querySelector<HTMLBaseElement>(
    `base[${TRANSIENT_BASE_ATTRIBUTE}]`,
  )
  if (base) document.head.prepend(document.importNode(base, true))
}

export function absolutizeHeadResources(
  nextDocument: Document,
  baseUrl: URL,
): void {
  for (const element of nextDocument.head.querySelectorAll('link[href], script[src]')) {
    const attribute = element.localName === 'link' ? 'href' : 'src'
    const value = element.getAttribute(attribute)
    if (!value) continue
    try {
      element.setAttribute(attribute, new URL(value, baseUrl).href)
    } catch {
      // Preserve invalid URLs so the browser handles them normally.
    }
  }
}

function normalizedHeadNode(element: Element, baseUrl: URL): Element {
  const clone = element.cloneNode(true) as Element
  clone.removeAttribute(EXECUTED_SCRIPT_ATTRIBUTE)
  for (const attribute of ['href', 'src']) {
    if (element.hasAttribute(attribute)) {
      clone.setAttribute(attribute, resolvedAttribute(element, attribute, baseUrl))
    }
  }
  return clone
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

  if (next.hasAttribute(RERUN_SCRIPT_ATTRIBUTE)) return false
  return normalizedHeadNode(current, currentUrl)
    .isEqualNode(normalizedHeadNode(next, nextUrl))
}

function runtimeEntryAttribute(
  element: Element,
): typeof RUNTIME_SCRIPT_ATTRIBUTES[number] | undefined {
  return RUNTIME_SCRIPT_ATTRIBUTES.find((attribute) => (
    element.matches(`script[${attribute}][src]`)
  ))
}

export function stylesheetHrefs(root: ParentNode, baseUrl: URL): Set<string> {
  return new Set(
    [...root.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')]
      .map((link) => resolvedAttribute(link, 'href', baseUrl)),
  )
}

export function initialDocumentStyles(baseUrl: URL): Set<string> {
  const runtimeScripts = [
    ...document.querySelectorAll<HTMLScriptElement>(RUNTIME_SCRIPT_SELECTOR),
  ]
  const lastRuntime = runtimeScripts.at(-1)
  return new Set(
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')]
      .filter((link) => (
        !lastRuntime
        || (
          lastRuntime.compareDocumentPosition(link)
          & Node.DOCUMENT_POSITION_FOLLOWING
        ) === 0
      ))
      .map((link) => resolvedAttribute(link, 'href', baseUrl)),
  )
}

export function syncHead(
  nextDocument: Document,
  currentUrl: URL,
  nextUrl: URL,
  clientStyles: ReadonlySet<string>,
): void {
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
  // Vite inserts lazy island/behavior stylesheets at runtime. They are absent
  // from fetched HTML and must survive swaps because its module preload cache
  // will not insert the same stylesheet twice.
  for (const current of currentNodes) {
    const runtimeAttribute = runtimeEntryAttribute(current)
    if (
      !reused.has(current)
      && (
        (
          runtimeAttribute !== undefined
          && !nextDocument.querySelector(`script[${runtimeAttribute}][src]`)
        )
        || (
          current.matches('link[rel="stylesheet"][href]')
          && clientStyles.has(resolvedAttribute(current, 'href', currentUrl))
        )
      )
    ) {
      reused.add(current)
      desired.push(current)
    }
  }
  // Appending an existing child moves it without recreating an executed script.
  for (const node of desired) document.head.append(node)
  for (const current of currentNodes) {
    if (!reused.has(current)) current.remove()
  }
}

export function preloadNewStyles(
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

export function copyAttributes(
  from: Element,
  to: Element,
  preserved: string[] = [],
): void {
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
