import type { NavigationPrefetchPolicy } from './types'

export const HOVER_PREFETCH_DELAY_MS = 80

export function elementHref(element: Element): string | null {
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
export function linkFromEvent(event: Event): Element | null {
  const pathTarget = typeof event.composedPath === 'function'
    ? event.composedPath()[0]
    : event.target
  if (!(pathTarget instanceof Element)) return null
  const link = pathTarget.closest('a[href], area[href]')
  return link && elementHref(link) ? link : null
}

export function effectiveNavigationTarget(
  element: Element,
  override: string | null = null,
): string {
  const target = override
    ?? element.getAttribute('target')
    ?? element.ownerDocument.querySelector('base[target]')?.getAttribute('target')
    ?? ''
  return target.toLowerCase()
}

export function linkTarget(link: Element): string {
  return effectiveNavigationTarget(link)
}

function relIncludes(link: Element, value: string): boolean {
  return (link.getAttribute('rel') ?? '')
    .split(/[\t\n\f\r ]+/)
    .some((token) => token.toLowerCase() === value)
}

export function eligibleLink(link: Element): URL | null {
  const href = elementHref(link)
  if (!href) return null
  if (
    link.hasAttribute('download')
    || link.hasAttribute('data-nib-navigation-reload')
    || link.hasAttribute('ping')
    || link.hasAttribute('referrerpolicy')
    || relIncludes(link, 'noreferrer')
  ) {
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

export type PrefetchMode = 'hover' | 'load' | 'tap' | 'viewport'

export function prefetchMode(
  link: Element,
  policy: NavigationPrefetchPolicy,
): PrefetchMode | null {
  const value = link.getAttribute('data-nib-prefetch')
  if (value === 'false') return null
  if (
    value === 'hover'
    || value === 'tap'
    || value === 'load'
    || value === 'viewport'
  ) return value
  return policy === 'hover' ? 'hover' : null
}
