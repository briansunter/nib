import type { PageModule, ResolvedRoute, SiteConfig } from './types'
import { resolveMeta } from './meta'
import { fileToRoute, normalizePath } from './paths'

export function createRoutes(
  modules: Record<string, PageModule>,
  site: SiteConfig,
): Map<string, ResolvedRoute> {
  const routes = new Map<string, ResolvedRoute>()

  for (const [file, module] of Object.entries(modules)) {
    const path = fileToRoute(file)
    if (routes.has(path)) {
      throw new Error(`Duplicate route ${path}: ${routes.get(path)?.source} and ${file}`)
    }
    if (module.meta?.draft) continue

    routes.set(path, {
      path,
      component: module.default,
      meta: resolveMeta(module.meta, site),
      source: file,
      status: path === '/404' ? 404 : 200
    })
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
    status: 404
  }
}
