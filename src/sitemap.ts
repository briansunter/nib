import { definePlugin, type NibResolvedPageRoute } from './framework/plugin'
import { deployedOrigin, deployedRouteUrl } from './framework/deployed-url'

export interface SitemapOptions {
  /** Overrides site.origin. */
  site?: string | URL
  /** Output route. Defaults to /sitemap.xml. */
  path?: string
  /** Optionally exclude page routes from the sitemap. */
  filter?: (route: NibResolvedPageRoute) => boolean
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function sitemap(options: SitemapOptions) {
  if (options === null || typeof options !== 'object') {
    throw new Error('Nib sitemap requires an options object')
  }
  if (options.site !== undefined) deployedOrigin(options.site, undefined, 'Nib sitemap site')
  const routePath = options.path ?? '/sitemap.xml'
  if (!routePath.startsWith('/')) {
    throw new Error('Nib sitemap path must be an absolute route path')
  }

  return definePlugin({
    name: '@briansunter/nib/sitemap',
    routes(context) {
      const site = deployedOrigin(options.site, context.site.origin, 'Nib sitemap site')
      const entries = context.routes
        .filter((route): route is NibResolvedPageRoute => (
          route.kind === 'page'
          && route.status === 200
          && (options.filter?.(route) ?? true)
        ))
        .map((route) => (
          `  <url><loc>${escapeXml(deployedRouteUrl(site, context.base, route.path))}</loc></url>`
        ))
      return {
        kind: 'resource',
        path: routePath,
        contentType: 'application/xml; charset=utf-8',
        body: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...entries,
          '</urlset>',
        ].join('\n'),
      } as const
    },
  })
}
