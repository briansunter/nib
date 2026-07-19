import { definePlugin, type NibResolvedPageRoute } from './framework/plugin'

export interface SitemapOptions {
  /** Deployed site origin, for example https://example.com. Nib adds base. */
  site: string | URL
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

function deployedUrl(site: URL, base: string, routePath: string): string {
  const basePath = base === '/' ? '/' : `/${base.replace(/^\/+|\/+$/g, '')}/`
  const relative = routePath === '/' ? '' : routePath.replace(/^\/+/, '')
  return new URL(`${basePath}${relative}`, site).href
}

export function sitemap(options: SitemapOptions) {
  if (options === null || typeof options !== 'object') {
    throw new Error('Nib sitemap requires an options object')
  }
  const site = new URL(options.site)
  if (!['http:', 'https:'].includes(site.protocol)) {
    throw new Error('Nib sitemap site must use HTTP or HTTPS')
  }
  if (site.pathname !== '/' || site.search !== '' || site.hash !== '') {
    throw new Error('Nib sitemap site must be an origin without a path, query, or hash')
  }
  const routePath = options.path ?? '/sitemap.xml'
  if (!routePath.startsWith('/')) {
    throw new Error('Nib sitemap path must be an absolute route path')
  }

  return definePlugin({
    name: '@briansunter/nib/sitemap',
    routes(context) {
      const entries = context.routes
        .filter((route): route is NibResolvedPageRoute => (
          route.kind === 'page'
          && route.status === 200
          && (options.filter?.(route) ?? true)
        ))
        .map((route) => (
          `  <url><loc>${escapeXml(deployedUrl(site, context.base, route.path))}</loc></url>`
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
