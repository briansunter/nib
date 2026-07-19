import { describe, expect, it } from 'vitest'
import { sitemap } from '../src/sitemap'

const context = {
  command: 'build' as const,
  mode: 'production' as const,
  root: '/site',
  base: '/docs/',
  site: { title: 'Docs' },
}

describe('sitemap plugin', () => {
  it('emits only successful page routes with base-safe absolute URLs', async () => {
    const plugin = sitemap({
      site: 'https://example.test',
      filter: (route) => route.path !== '/private/',
    })
    if (!plugin.routes) throw new Error('Sitemap plugin has no route provider')
    const route = await plugin.routes({
      ...context,
      routes: Object.freeze([
        Object.freeze({ kind: 'page' as const, path: '/', source: 'page', status: 200, meta: {} }),
        Object.freeze({ kind: 'page' as const, path: '/private/', source: 'page', status: 200, meta: {} }),
        Object.freeze({ kind: 'page' as const, path: '/404/', source: 'page', status: 404, meta: {} }),
        Object.freeze({ kind: 'resource' as const, path: '/rss.xml', source: 'plugin', status: 200, contentType: 'application/xml' }),
      ]),
    })
    expect(route).toMatchObject({
      kind: 'resource',
      path: '/sitemap.xml',
      contentType: 'application/xml; charset=utf-8',
    })
    if (!route || Array.isArray(route) || route.kind !== 'resource') {
      throw new Error('Expected a sitemap resource route')
    }
    expect(route.body).toContain('<loc>https://example.test/docs/</loc>')
    expect(route.body).not.toContain('private')
    expect(route.body).not.toContain('rss.xml')
  })

  it('rejects non-origin sitemap sites and invalid output paths', () => {
    expect(() => sitemap({ site: 'ftp://example.test' })).toThrow('HTTP or HTTPS')
    expect(() => sitemap({ site: 'https://example.test/docs' })).toThrow('origin')
    expect(() => sitemap({ site: 'https://example.test', path: 'sitemap.xml' }))
      .toThrow('absolute route path')
  })

  it('uses site.origin when no plugin-specific origin is supplied', async () => {
    const plugin = sitemap({})
    if (!plugin.routes) throw new Error('Sitemap plugin has no route provider')
    const route = await plugin.routes({
      ...context,
      site: { title: 'Docs', origin: 'https://docs.example' },
      routes: Object.freeze([
        Object.freeze({ kind: 'page' as const, path: '/', source: 'page', status: 200, meta: {} }),
      ]),
    })
    if (!route || Array.isArray(route) || route.kind !== 'resource') {
      throw new Error('Expected a sitemap resource route')
    }
    expect(route.body).toContain('<loc>https://docs.example/docs/</loc>')
  })
})
