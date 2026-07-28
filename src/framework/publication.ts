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
  if (value.startsWith('//')) {
    throw new Error('Route paths cannot be protocol-relative URLs')
  }
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

export interface PublicationPlanInput {
  readonly routePath: string
  readonly output: RenderedOutput
}

export interface PublicationArtifactPlanEntry {
  readonly routePath: string
  readonly artifact: string
}

function routeAncestors(normalizedPath: string): string[] {
  const ancestors: string[] = []
  let parentEnd = normalizedPath.lastIndexOf('/')
  while (parentEnd > 0) {
    const parent = normalizedPath.slice(0, parentEnd)
    ancestors.push(parent)
    parentEnd = parent.lastIndexOf('/')
  }
  return ancestors
}

function assertUniqueArtifactDestinations(
  entries: readonly PublicationArtifactPlanEntry[],
): void {
  const owners = new Map<string, string>()
  for (const entry of entries) {
    const existing = owners.get(entry.artifact)
    if (existing !== undefined) {
      throw new Error(
        `Nib cannot publish routes ${JSON.stringify(existing)} and `
        + `${JSON.stringify(entry.routePath)} to the same artifact `
        + `${JSON.stringify(entry.artifact)}`,
      )
    }
    owners.set(entry.artifact, entry.routePath)
  }

  for (const entry of entries) {
    const segments = entry.artifact.split('/')
    let parentArtifact = ''
    for (let index = 1; index < segments.length; index += 1) {
      parentArtifact += `${index === 1 ? '' : '/'}${segments[index - 1]!}`
      const parentOwner = owners.get(parentArtifact)
      if (parentOwner !== undefined) {
        throw new Error(
          `Nib cannot publish route ${JSON.stringify(entry.routePath)} to `
          + `${JSON.stringify(entry.artifact)} because route `
          + `${JSON.stringify(parentOwner)} publishes the required directory `
          + `${JSON.stringify(parentArtifact)} as a file`,
        )
      }
    }
  }
}

/**
 * Plans every static artifact before publication. Ancestors are indexed once
 * so extensionless parent routes can coexist with descendants without a
 * route-by-route scan.
 */
export function createPublicationArtifactPlan(
  routePaths: readonly string[],
  policy: TrailingSlash = 'ignore',
): readonly PublicationArtifactPlanEntry[] {
  const normalizedPaths = routePaths.map(normalizePath)
  const routesWithDescendants = new Set(
    normalizedPaths.flatMap((routePath) => routeAncestors(routePath)),
  )
  const plan = routePaths.map((routePath, index): PublicationArtifactPlanEntry => {
    const normalizedPath = normalizedPaths[index]!
    return {
      routePath,
      artifact: normalizedPath === '/404'
        ? '404.html'
        : routeArtifacts(
          normalizedPath,
          policy,
          routesWithDescendants.has(normalizedPath),
        ).primary,
    }
  })
  assertUniqueArtifactDestinations(plan)
  return plan
}

export function createPublicationPlan(
  entries: readonly PublicationPlanInput[],
  policy: TrailingSlash = 'ignore',
): readonly PublicationManifestInput[] {
  const artifacts = createPublicationArtifactPlan(
    entries.map(({ routePath }) => routePath),
    policy,
  )
  return entries.map(({ output }, index) => ({
    ...artifacts[index]!,
    output,
  }))
}

/** Reduces a rendered output to the metadata retained after its body is written. */
export function createPublicationManifestRoute(
  entry: PublicationManifestInput,
): PublicationManifestRoute {
  const { routePath, artifact, output } = entry
  if (output.kind === 'page') {
    return Object.freeze({
      kind: 'page',
      path: routePath,
      artifact,
      status: output.page.status,
      contentType: 'text/html; charset=utf-8',
    })
  }
  if (output.kind === 'resource') {
    return Object.freeze({
      kind: 'resource',
      path: routePath,
      artifact,
      status: output.status,
      contentType: output.contentType,
    })
  }
  return Object.freeze({
    kind: 'redirect',
    path: routePath,
    artifact,
    status: output.status,
    contentType: 'text/html; charset=utf-8',
    destination: output.destination,
  })
}

/** Creates the deployable route-to-artifact contract for static hosts. */
export function createPublicationManifestFromRoutes(
  base: string,
  trailingSlash: TrailingSlash | undefined,
  inputRoutes: readonly PublicationManifestRoute[],
): PublicationManifest {
  const routes = [...inputRoutes]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((route) => Object.freeze({ ...route }))
  return Object.freeze({
    version: 1,
    base,
    trailingSlash: trailingSlash ?? 'ignore',
    routes: Object.freeze(routes),
  })
}

export function createPublicationManifest(
  base: string,
  trailingSlash: TrailingSlash | undefined,
  entries: readonly PublicationManifestInput[],
): PublicationManifest {
  return createPublicationManifestFromRoutes(
    base,
    trailingSlash,
    entries.map(createPublicationManifestRoute),
  )
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
