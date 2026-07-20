import type { RenderedOutput, TrailingSlash } from './types'

/** Public route identity, static artifact paths, and preview rewriting in one place. */
export function normalizePath(url: string): string {
  const pathname = new URL(url, 'http://nib.local').pathname
  if (pathname === '/') return '/'
  return pathname.replace(/\/+$/, '')
}

export function isFileRoute(pathname: string): boolean {
  const segment = pathname.replace(/\/+$/, '').split('/').at(-1) ?? ''
  return /\.[A-Za-z0-9]+$/.test(segment)
}

export function canonicalRoutePath(
  value: string,
  trailingSlash: TrailingSlash = 'ignore',
): string {
  const path = normalizePath(value)
  if (path === '/' || isFileRoute(path)) return path
  return trailingSlash === 'always' ? `${path}/` : path
}

export function stripBasePath(path: string, basePath: string): string {
  const parsed = new URL(path, 'http://nib.local')
  const normalizedPath = parsed.pathname.startsWith('/') ? parsed.pathname : `/${parsed.pathname}`
  const normalizedBase = basePath.startsWith('/') ? basePath : `/${basePath}`
  const prefix = normalizedBase.replace(/\/+$/, '')
  let stripped = normalizedPath
  if (prefix && (normalizedPath === prefix || normalizedPath === `${prefix}/`)) {
    stripped = '/'
  } else if (prefix && normalizedPath.startsWith(`${prefix}/`)) {
    stripped = normalizedPath.slice(prefix.length) || '/'
  }
  return `${stripped}${parsed.search}${parsed.hash}`
}

export function publicRouteHref(base: string, routePath: string): string {
  if (routePath === '/') return base
  return `${base}${routePath.replace(/^\/+/, '')}`
}

export interface RouteArtifacts {
  /** The static artifact served at the route's canonical public path. */
  readonly primary: string
}

export interface PublicationManifestRoute {
  readonly kind: 'page' | 'resource' | 'redirect'
  readonly path: string
  readonly artifact: string
  readonly status: number
  readonly contentType: string
  readonly destination?: string
}

export interface PublicationManifest {
  readonly version: 1
  readonly base: string
  readonly trailingSlash: TrailingSlash
  readonly routes: readonly PublicationManifestRoute[]
}

export interface PublicationManifestInput {
  readonly routePath: string
  readonly artifact: string
  readonly output: RenderedOutput
}

/** Creates the deployable route-to-artifact contract for static hosts. */
export function createPublicationManifest(
  base: string,
  trailingSlash: TrailingSlash | undefined,
  entries: readonly PublicationManifestInput[],
): PublicationManifest {
  const routes = entries.map(({ routePath, artifact, output }): PublicationManifestRoute => {
    if (output.kind === 'page') {
      return {
        kind: 'page',
        path: routePath,
        artifact,
        status: output.page.status,
        contentType: 'text/html; charset=utf-8',
      }
    }
    if (output.kind === 'resource') {
      return {
        kind: 'resource',
        path: routePath,
        artifact,
        status: output.status,
        contentType: output.contentType,
      }
    }
    return {
      kind: 'redirect',
      path: routePath,
      artifact,
      status: output.status,
      contentType: 'text/html; charset=utf-8',
      destination: output.destination,
    }
  }).sort((left, right) => left.path.localeCompare(right.path))

  return Object.freeze({
    version: 1,
    base,
    trailingSlash: trailingSlash ?? 'ignore',
    routes: Object.freeze(routes.map((route) => Object.freeze(route))),
  })
}

/**
 * Maps a public route to its static artifact. `never` emits an extensionless
 * file for leaf routes; route parents retain an index artifact so they can
 * coexist with their child paths in a normal filesystem.
 */
export function routeArtifacts(
  routePath: string,
  policy: TrailingSlash = 'ignore',
  hasDescendants = false,
): RouteArtifacts {
  const normalized = routePath.replace(/^\/+|\/+$/g, '')
  if (isFileRoute(routePath)) return { primary: normalized }
  if (routePath === '/') return { primary: 'index.html' }
  if (policy === 'never' && !hasDescendants) {
    return { primary: normalized }
  }
  return { primary: `${normalized}/index.html` }
}

/** Relative canonical client artifact path; callers own the output directory. */
export function routeArtifactPath(
  routePath: string,
  policy: TrailingSlash = 'ignore',
  hasDescendants = false,
): string {
  return routeArtifacts(routePath, policy, hasDescendants).primary
}

export function canonicalRequestRedirect(
  url: string,
  base: string,
  routePath: string,
  policy: TrailingSlash | undefined,
): string | undefined {
  if (policy === undefined || policy === 'ignore' || routePath === '/') return undefined
  const parsed = new URL(stripBasePath(url, base), 'http://nib.local')
  if (parsed.pathname === routePath) return undefined
  return `${publicRouteHref(base, routePath)}${parsed.search}${parsed.hash}`
}

/** Canonicalizes preview URLs before Vite chooses a static artifact. */
export function previewCanonicalRedirect(
  url: string,
  base: string,
  policy: TrailingSlash | undefined,
): string | undefined {
  if (policy === undefined || policy === 'ignore') return undefined
  const parsed = new URL(stripBasePath(url, base), 'http://nib.local')
  if (parsed.pathname === '/' || isFileRoute(parsed.pathname)) {
    return undefined
  }
  const canonical = canonicalRoutePath(parsed.pathname, policy)
  if (parsed.pathname === canonical) return undefined
  return `${publicRouteHref(base, canonical)}${parsed.search}${parsed.hash}`
}

/**
 * Finds a canonical extensionless page artifact for preview. Callers must only
 * serve it to HTML navigation requests because resource routes may also omit an
 * extension and own their content type.
 */
export function previewExtensionlessPageArtifacts(
  url: string,
  base: string,
  policy: TrailingSlash | undefined,
): readonly string[] | undefined {
  if (policy !== 'never') return undefined
  const parsed = new URL(stripBasePath(url, base), 'http://nib.local')
  if (parsed.pathname === '/' || parsed.pathname.endsWith('/') || isFileRoute(parsed.pathname)) {
    return undefined
  }
  const artifact = routeArtifactPath(parsed.pathname, policy)
  return [artifact, `${artifact}/index.html`]
}
