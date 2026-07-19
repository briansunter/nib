import type { ComponentType } from 'react'
import type {
  GeneratedPage,
  PageModule,
  ResolvedRoute,
  SiteConfig,
} from './types'
import { resolveMeta } from './meta'
import { fileToRoute, normalizePath } from './paths'

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
): Map<string, ResolvedRoute> {
  const routes = new Map<string, ResolvedRoute>()
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
      const path = normalizePath(page.path)
      const source = pages.length === 1 ? file : `${file}#${index}`
      const previous = sources.get(path)
      if (previous) {
        throw new Error(`Duplicate route ${path}: ${previous} and ${source}`)
      }
      sources.set(path, source)
      if (page.meta?.draft) continue

      routes.set(path, {
        path,
        component: page.component,
        meta: resolveMeta(page.meta, site),
        source,
        status: path === '/404' ? 404 : 200,
        ...(page.data === undefined ? {} : { data: page.data }),
        ...(module.frontmatter === undefined ? {} : { frontmatter: module.frontmatter }),
        layouts: routeLayouts(file, page.layout, folders, named),
      })
    }
  }

  return routes
}

export function getRoute(
  routes: Map<string, ResolvedRoute>,
  url: string,
): ResolvedRoute {
  const path = normalizePath(url)
  return routes.get(path) ?? routes.get('/404') ?? {
    path: '/404',
    component: () => null,
    meta: { title: 'Not found', description: 'The requested page does not exist.' },
    source: 'generated',
    status: 404,
    layouts: [],
  }
}
