import type { ComponentType } from 'react'
import type {
  GeneratedPage,
  PageModule,
  RedirectDefinition,
  ResolvedRoute,
  ResolvedPageRoute,
  SiteConfig,
  TrailingSlash,
} from './types'
import type { OwnedRouteRegistration } from './plugin'
import { resolveMeta } from './meta'
import { canonicalRoutePath, fileToRoute, normalizePath } from './paths'

interface LayoutModule {
  default?: ComponentType<any>
}

export interface RouteLayouts {
  folders?: Record<string, LayoutModule>
  named?: Record<string, LayoutModule>
}

function layoutComponent(module: LayoutModule, file: string): ComponentType<any> {
  if (typeof module.default !== 'function') {
    throw new Error(`Layout must default-export a React component: ${file}`)
  }
  return module.default
}

function folderLayoutMap(modules: Record<string, LayoutModule> | undefined) {
  const layouts = new Map<string, ComponentType<any>>()
  for (const [file, module] of Object.entries(modules ?? {})) {
    const normalized = file.replaceAll('\\', '/')
    const match = normalized.match(/(?:^|\/)pages\/(.*?)layout\.tsx$/)
    if (!match) throw new Error(`Invalid folder layout file: ${file}`)
    layouts.set(match[1].replace(/\/+$/, ''), layoutComponent(module, file))
  }
  return layouts
}

function namedLayoutMap(modules: Record<string, LayoutModule> | undefined) {
  const layouts = new Map<string, ComponentType<any>>()
  for (const [file, module] of Object.entries(modules ?? {})) {
    const normalized = file.replaceAll('\\', '/')
    const match = normalized.match(/(?:^|\/)layouts\/([A-Za-z0-9_-]+)\.tsx$/)
    if (!match) throw new Error(`Named layouts must use flat filenames: ${file}`)
    layouts.set(match[1], layoutComponent(module, file))
  }
  return layouts
}

function folderNames(file: string): string[] {
  const normalized = file.replaceAll('\\', '/')
  const match = normalized.match(/(?:^|\/)pages\/(.*?)page\.[A-Za-z0-9]+$/)
  if (!match) throw new Error(`Invalid page file: ${file}`)
  const directory = match[1].replace(/\/+$/, '')
  if (!directory) return ['']
  const segments = directory.split('/')
  return ['', ...segments.map((_, index) => segments.slice(0, index + 1).join('/'))]
}

function routeLayouts(
  file: string,
  layout: string | undefined,
  folders: Map<string, ComponentType<any>>,
  named: Map<string, ComponentType<any>>,
): ComponentType<any>[] {
  const resolved = folderNames(file)
    .map((name) => folders.get(name))
    .filter((component): component is ComponentType<any> => component !== undefined)
  if (layout) {
    const component = named.get(layout)
    if (!component) throw new Error(`Unknown layout ${layout} for ${file}`)
    resolved.push(component)
  }
  return resolved
}

export function createRoutes(
  modules: Record<string, PageModule>,
  site: SiteConfig,
  layoutModules: RouteLayouts = {},
  trailingSlash: TrailingSlash = 'ignore',
): Map<string, ResolvedPageRoute> {
  const routes = new Map<string, ResolvedPageRoute>()
  const sources = new Map<string, string>()
  const folders = folderLayoutMap(layoutModules.folders)
  const named = namedLayoutMap(layoutModules.named)

  for (const [file, module] of Object.entries(modules)) {
    const pages: GeneratedPage[] = module.pages ?? (
      module.default
        ? [{
            path: fileToRoute(file),
            component: module.default,
            data: undefined,
            ...(module.meta ? { meta: module.meta } : {}),
            ...(module.layout ? { layout: module.layout } : {}),
          }]
        : []
    )
    if (pages.length === 0) {
      throw new Error(`Page module must export a default component or generated pages: ${file}`)
    }

    for (const [index, page] of pages.entries()) {
      const path = canonicalRoutePath(page.path, trailingSlash)
      const routeKey = normalizePath(path)
      const source = pages.length === 1 ? file : `${file}#${index}`
      const previous = sources.get(routeKey)
      if (previous) {
        throw new Error(`Duplicate route ${path}: ${previous} and ${source}`)
      }
      sources.set(routeKey, source)
      if (page.meta?.draft) continue

      routes.set(routeKey, {
        kind: 'page',
        path,
        component: page.component,
        meta: resolveMeta(page.meta, site),
        source,
        status: normalizePath(path) === '/404' ? 404 : 200,
        ...(page.data === undefined ? {} : { data: page.data }),
        ...(module.frontmatter === undefined ? {} : { frontmatter: module.frontmatter }),
        layouts: routeLayouts(file, page.layout, folders, named),
      })
    }
  }

  return routes
}

function validateRegisteredPath(
  value: unknown,
  label: string,
  trailingSlash: TrailingSlash,
): string {
  if (
    typeof value !== 'string'
    || !value.startsWith('/')
    || value.includes('?')
    || value.includes('#')
    || value.includes('\\')
  ) {
    throw new Error(`${label} path must start with "/" and contain no query, hash, or backslash`)
  }
  return canonicalRoutePath(value, trailingSlash)
}

function redirectDestination(
  value: unknown,
  trailingSlash: TrailingSlash,
  label: string,
): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${label} destination must be a non-empty string`)
  }
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`${label} destination must use HTTP or HTTPS`)
    }
    return url.href
  }
  if (!value.startsWith('/')) {
    throw new Error(`${label} destination must be an absolute path or HTTP(S) URL`)
  }
  const parsed = new URL(value, 'http://nib.local')
  return `${canonicalRoutePath(parsed.pathname, trailingSlash)}${parsed.search}${parsed.hash}`
}

function addRoute(
  routes: Map<string, ResolvedRoute>,
  route: ResolvedRoute,
): void {
  const key = normalizePath(route.path)
  const previous = routes.get(key)
  if (previous) {
    throw new Error(`Duplicate route ${route.path}: ${previous.source} and ${route.source}`)
  }
  routes.set(key, route)
}

export function addConfiguredRedirects(
  routes: Map<string, ResolvedRoute>,
  redirects: Readonly<Record<string, RedirectDefinition>> | undefined,
  trailingSlash: TrailingSlash = 'ignore',
): void {
  for (const [rawPath, definition] of Object.entries(redirects ?? {})) {
    const path = validateRegisteredPath(
      rawPath,
      `Configured redirect ${rawPath}`,
      trailingSlash,
    )
    const destination = redirectDestination(
      typeof definition === 'string' ? definition : definition.destination,
      trailingSlash,
      `Configured redirect ${rawPath}`,
    )
    if (destination === path) {
      throw new Error(`Configured redirect ${rawPath} cannot redirect to itself`)
    }
    addRoute(routes, {
      kind: 'redirect',
      path,
      source: `nib.config.ts redirects[${JSON.stringify(rawPath)}]`,
      status: typeof definition === 'string' ? 301 : redirectStatus(
        definition.status ?? 301,
        `Configured redirect ${rawPath}`,
      ),
      destination,
    })
  }
}

export function addPluginRoutes(
  routes: Map<string, ResolvedRoute>,
  contributions: readonly OwnedRouteRegistration[],
  site: SiteConfig,
  trailingSlash: TrailingSlash = 'ignore',
): void {
  for (const [index, { plugin, route }] of contributions.entries()) {
    const label = `Nib plugin ${plugin.name} route ${index}`
    if (route === null || typeof route !== 'object' || Array.isArray(route)) {
      throw new Error(`${label} must be a route object`)
    }
    const path = validateRegisteredPath(route.path, label, trailingSlash)
    const source = `${plugin.name} routes()[${index}]`
    if (route.kind === 'page') {
      if (typeof route.component !== 'function') {
        throw new Error(`${label} page component must be a React component`)
      }
      addRoute(routes, {
        kind: 'page',
        path,
        component: route.component,
        meta: resolveMeta(route.meta, site),
        source,
        status: normalizePath(path) === '/404' ? 404 : 200,
        ...(route.data === undefined ? {} : { data: route.data }),
        layouts: [],
      })
      continue
    }
    if (route.kind === 'resource') {
      if (typeof route.body !== 'string') {
        throw new Error(`${label} resource body must be a string`)
      }
      if (
        typeof route.contentType !== 'string'
        || !route.contentType.includes('/')
        || /[\r\n]/.test(route.contentType)
      ) {
        throw new Error(`${label} resource contentType must be a MIME type`)
      }
      const status = route.status ?? 200
      if (!Number.isInteger(status) || status < 200 || status > 599) {
        throw new Error(`${label} resource status must be an integer from 200 to 599`)
      }
      addRoute(routes, {
        kind: 'resource',
        path,
        source,
        status,
        body: route.body,
        contentType: route.contentType,
      })
      continue
    }
    if (route.kind === 'redirect') {
      const destination = redirectDestination(route.destination, trailingSlash, label)
      if (destination === path) throw new Error(`${label} cannot redirect to itself`)
      addRoute(routes, {
        kind: 'redirect',
        path,
        source,
        status: redirectStatus(route.status ?? 301, label),
        destination,
      })
      continue
    }
    throw new Error(`${label} has an unknown route kind`)
  }
}

function redirectStatus(value: unknown, label: string): 301 | 302 | 307 | 308 {
  if (value === 301 || value === 302 || value === 307 || value === 308) return value
  throw new Error(`${label} redirect status must be 301, 302, 307, or 308`)
}

export function getRoute(
  routes: Map<string, ResolvedRoute>,
  url: string,
): ResolvedRoute {
  const path = normalizePath(url)
  return routes.get(path) ?? routes.get('/404') ?? {
    kind: 'page',
    path: '/404',
    component: () => null,
    meta: { title: 'Not found', description: 'The requested page does not exist.' },
    source: 'generated',
    status: 404,
    layouts: [],
  }
}
