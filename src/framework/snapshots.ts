import { deepFreeze } from './freeze'
import { normalizeHeadContribution } from './meta'
import type {
  PageRoute,
  ResolvedPageRoute,
  ResolvedRoute,
  ResolvedSite,
  RouteSnapshot,
  SiteConfig,
} from './types'

/** Copies site configuration into the deeply immutable public shape. */
export function resolvedSiteSnapshot(site: SiteConfig): ResolvedSite {
  const head = normalizeHeadContribution(site.head, 'Nib site.head')
  return deepFreeze({
    title: site.title,
    ...(site.origin === undefined ? {} : { origin: site.origin }),
    ...(site.description === undefined ? {} : { description: site.description }),
    ...(site.titleTemplate === undefined ? {} : { titleTemplate: site.titleTemplate }),
    ...(site.navigation === undefined
      ? {}
      : { navigation: site.navigation.map((item) => ({ ...item })) }),
    ...(head === undefined ? {} : { head }),
  })
}

/** Removes renderer-only fields before a route crosses a public boundary. */
export function resolvedRouteSnapshot(route: ResolvedPageRoute): PageRoute
export function resolvedRouteSnapshot(route: ResolvedRoute): RouteSnapshot
export function resolvedRouteSnapshot(route: ResolvedRoute): RouteSnapshot {
  if (route.kind === 'page') {
    const head = normalizeHeadContribution(route.meta.head, `Route ${route.path} head`)
    return deepFreeze({
      kind: 'page',
      path: route.path,
      source: route.source,
      status: route.status,
      meta: {
        ...route.meta,
        ...(head === undefined ? {} : { head }),
      },
    })
  }
  if (route.kind === 'resource') {
    return Object.freeze({
      kind: 'resource',
      path: route.path,
      source: route.source,
      status: route.status,
      contentType: route.contentType,
    })
  }
  return Object.freeze({
    kind: 'redirect',
    path: route.path,
    source: route.source,
    status: route.status,
    destination: route.destination,
  })
}
