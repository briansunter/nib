import { describe, expect, it } from 'vitest'
import { rss } from '../src/rss'

const context = {
  command: 'build' as const,
  mode: 'production' as const,
  root: '/site',
  base: '/journal/',
  site: { title: 'Journal' },
  routes: Object.freeze([
    Object.freeze({ kind: 'page' as const, path: '/', source: 'page', status: 200, meta: {} }),
  ]),
}

describe('RSS plugin', () => {
  it('emits base-safe RSS 2.0 XML with escaped, typed item fields', async () => {
    const plugin = rss({
      site: 'https://example.test',
      title: 'Journal & notes',
      description: 'The <good> things',
      language: 'en-US',
      lastBuildDate: '2026-07-19T12:00:00Z',
      ttl: 60,
      items: [
        {
          title: 'One & two',
          link: '/articles/one/',
          description: 'A <summary>',
          content: '<p>Longer content</p>',
          pubDate: new Date('2026-07-18T00:00:00Z'),
          guid: 'article:one',
          author: 'author@example.test (Author)',
          categories: ['Notes', 'TypeScript'],
          enclosure: {
            url: 'https://cdn.example.test/one.mp3',
            type: 'audio/mpeg',
            length: 42,
          },
        },
      ],
    })
    if (!plugin.routes) throw new Error('RSS plugin has no route provider')
    const route = await plugin.routes(context)
    expect(route).toMatchObject({
      kind: 'resource',
      path: '/rss.xml',
      contentType: 'application/rss+xml; charset=utf-8',
    })
    if (!route || Array.isArray(route) || route.kind !== 'resource') {
      throw new Error('Expected an RSS resource route')
    }
    expect(route.body).toContain('<link>https://example.test/journal/</link>')
    expect(route.body).toContain('href="https://example.test/journal/rss.xml"')
    expect(route.body).toContain('<title>Journal &amp; notes</title>')
    expect(route.body).toContain('<title>One &amp; two</title>')
    expect(route.body).toContain('<link>https://example.test/journal/articles/one/</link>')
    expect(route.body).toContain('<description>A &lt;summary&gt;</description>')
    expect(route.body).toContain('<content:encoded><![CDATA[<p>Longer content</p>]]></content:encoded>')
    expect(route.body).toContain('<pubDate>Sat, 18 Jul 2026 00:00:00 GMT</pubDate>')
    expect(route.body).toContain('<enclosure url="https://cdn.example.test/one.mp3" type="audio/mpeg" length="42" />')
  })

  it('supports async item providers with the immutable route snapshot', async () => {
    const plugin = rss({
      site: new URL('https://example.test'),
      title: 'Journal',
      description: 'Entries',
      path: '/feeds/journal.xml',
      async items(received) {
        expect(received).toBe(context)
        expect(Object.isFrozen(received.routes)).toBe(true)
        return [{ title: 'Home', link: '/' }]
      },
    })
    if (!plugin.routes) throw new Error('RSS plugin has no route provider')
    const route = await plugin.routes(context)
    if (!route || Array.isArray(route) || route.kind !== 'resource') {
      throw new Error('Expected an RSS resource route')
    }
    expect(route.path).toBe('/feeds/journal.xml')
    expect(route.body).toContain('href="https://example.test/journal/feeds/journal.xml"')
  })

  it('rejects invalid feed options and item data', async () => {
    expect(() => rss({
      site: 'ftp://example.test', title: 'Journal', description: 'Entries', items: [],
    })).toThrow('HTTP or HTTPS')
    expect(() => rss({
      site: 'https://example.test/docs', title: 'Journal', description: 'Entries', items: [],
    })).toThrow('origin')
    expect(() => rss({
      site: 'https://example.test', title: 'Journal', description: 'Entries', path: 'rss.xml', items: [],
    })).toThrow('absolute route path')
    expect(() => rss({
      site: 'https://example.test', title: 'Journal', description: 'Entries', ttl: -1, items: [],
    })).toThrow('non-negative integer')

    const plugin = rss({
      site: 'https://example.test',
      title: 'Journal',
      description: 'Entries',
      items: [{ title: 'Bad link', link: 'relative-link' }],
    })
    if (!plugin.routes) throw new Error('RSS plugin has no route provider')
    await expect(plugin.routes(context)).rejects.toThrow('absolute URL or an absolute route path')
  })
})
