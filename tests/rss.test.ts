import { describe, expect, it } from 'vitest'
import { rss } from '../src/rss'

const context = {
  command: 'build' as const,
  mode: 'production' as const,
  root: '/site',
  base: '/journal/',
  site: { title: 'Journal' },
  readCollection: () => {
    throw new Error('No collection capability configured')
  },
  routes: Object.freeze([
    Object.freeze({
      kind: 'page' as const,
      path: '/',
      source: 'page',
      status: 200,
      meta: { title: 'Home', description: 'Home page' },
    }),
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

  it('uses the configured site metadata when feed identity is not repeated', async () => {
    const plugin = rss({ items: [{ title: 'Home', link: '/' }] })
    if (!plugin.routes) throw new Error('RSS plugin has no route provider')
    const route = await plugin.routes({
      ...context,
      site: {
        title: 'Journal',
        description: 'Entries',
        origin: 'https://journal.example',
      },
    })
    if (!route || Array.isArray(route) || route.kind !== 'resource') {
      throw new Error('Expected an RSS resource route')
    }
    expect(route.body).toContain('<link>https://journal.example/journal/</link>')
    expect(route.body).toContain('<description>Entries</description>')
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
    expect(() => rss({
      site: 'https://example.test', title: 'Journal', description: 'Entries', stylesheet: '', items: [],
    })).toThrow('non-empty string')

    const plugin = rss({
      site: 'https://example.test',
      title: 'Journal',
      description: 'Entries',
      items: [{ title: 'Bad link', link: 'relative-link' }],
    })
    if (!plugin.routes) throw new Error('RSS plugin has no route provider')
    await expect(plugin.routes(context)).rejects.toThrow('absolute URL or an absolute route path')
  })

  it('emits stylesheet, dc creator, and channel metadata for original-feed parity', async () => {
    const plugin = rss({
      site: 'https://example.test',
      title: 'Journal',
      description: 'Entries',
      path: '/index.xml',
      language: 'en-us',
      copyright: '© 2026 Author',
      managingEditor: 'noreply@example.test (Author)',
      webMaster: 'noreply@example.test (Author)',
      stylesheet: '/rss/styles.xsl',
      items: [
        {
          title: 'With cover',
          link: '/posts/one/',
          description: 'A summary',
          content: '<p>Body with <img src="https://example.test/cover.webp" alt=""></p>',
          creator: 'Author',
          categories: ['Notes'],
        },
      ],
    })
    if (!plugin.routes) throw new Error('RSS plugin has no route provider')
    const route = await plugin.routes(context)
    if (!route || Array.isArray(route) || route.kind !== 'resource') {
      throw new Error('Expected an RSS resource route')
    }
    expect(route.body).toContain('<?xml-stylesheet type="text/xsl" href="/rss/styles.xsl"?>')
    expect(route.body).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"')
    expect(route.body).toContain('<language>en-us</language>')
    expect(route.body).toContain('<copyright>© 2026 Author</copyright>')
    expect(route.body).toContain('<managingEditor>noreply@example.test (Author)</managingEditor>')
    expect(route.body).toContain('<webMaster>noreply@example.test (Author)</webMaster>')
    expect(route.body).toContain('<dc:creator><![CDATA[Author]]></dc:creator>')
    expect(route.body).toContain('<content:encoded><![CDATA[<p>Body with <img src="https://example.test/cover.webp" alt=""></p>]]></content:encoded>')
    expect(route.body).toContain('href="https://example.test/journal/index.xml"')
  })
})
