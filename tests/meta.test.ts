import { describe, expect, it } from 'vitest'
import { metadata } from '../src/integrations/metadata'
import {
  metadataImageSrc,
  normalizeMetadataImage,
  renderHead,
  resolveMeta,
} from '../src/framework/meta'

describe('metadata', () => {
  it('requires page-authored titles', () => {
    expect(resolveMeta({ title: 'About' })).toEqual({ title: 'About' })
    expect(() => resolveMeta(undefined)).toThrow('non-empty title')
    expect(() => resolveMeta({ title: '  ' })).toThrow('non-empty title')
    expect(() => resolveMeta({
      title: 'About',
      head: { title: '  ' },
    })).toThrow('head.title must be a non-empty string')
    expect(() => renderHead(
      resolveMeta({ title: 'About' }),
      { title: '' },
    )).toThrow('Renderer head contribution.title must be a non-empty string')
  })
  it('renders escaped title and description tags', () => {
    const head = renderHead(resolveMeta({ title: '<a "x">&\'', description: 'One & two' }))
    expect(head).toContain('<title>&lt;a &quot;x&quot;&gt;&amp;&#039;</title>')
    expect(head).toContain('One &amp; two')
  })
  it('omits an absent description instead of emitting an empty meta tag', () => {
    expect(renderHead(resolveMeta({ title: 'Page' }))).toBe('<title>Page</title>')
  })

  it('dedupes keyed head elements so the later contributor wins', () => {
    const meta = resolveMeta({
      title: 'Dedup',
      head: {
        elements: [
          { key: 'shared', tag: 'meta', attributes: { name: 'x', content: 'AAA' } },
          { tag: 'meta', attributes: { name: 'y', content: 'BBB' } },
        ],
      },
    })
    const head = renderHead(meta, {
      elements: [
        { tag: 'meta', attributes: { name: 'z', content: 'CCC' } },
        { key: 'shared', tag: 'meta', attributes: { name: 'x', content: 'DDD' } },
        { key: 'shared', tag: 'meta', attributes: { name: 'x', content: 'EEE' } },
      ],
    })
    // The later element wins both across page+renderer and within the renderer.
    expect(head).toContain('<meta name="x" content="EEE" />')
    expect(head).not.toContain('AAA')
    expect(head).not.toContain('DDD')
    // Unkeyed elements from both contributors are all kept.
    expect(head).toContain('<meta name="y" content="BBB" />')
    expect(head).toContain('<meta name="z" content="CCC" />')
    // The key attribute is not serialized into the output HTML.
    expect(head).not.toContain('key=')
    expect(head).not.toContain('shared')
  })

  it('normalizes metadata image strings and structured objects', () => {
    expect(normalizeMetadataImage('/banner.png', 'banner')).toBe('/banner.png')
    expect(normalizeMetadataImage(
      { src: '/banner.png', alt: 'Banner', width: 1200, height: 630, type: 'image/png' },
      'banner',
    )).toEqual({ src: '/banner.png', alt: 'Banner', width: 1200, height: 630, type: 'image/png' })
    expect(() => normalizeMetadataImage({ width: 1200 }, 'banner'))
      .toThrow('banner.src must be a string')
  })

  it('reads the source URL from either metadata image form', () => {
    expect(metadataImageSrc('/banner.png')).toBe('/banner.png')
    expect(metadataImageSrc({ src: '/banner.png', width: 1200, height: 630 })).toBe('/banner.png')
    expect(metadataImageSrc(undefined)).toBeUndefined()
  })

  it('expands a structured route image into Open Graph and Twitter image tags', async () => {
    const plugin = metadata({ siteName: 'Nib', structuredData: false })
    const extension = await plugin.renderer?.({
      command: 'build', mode: 'production', root: '/site', base: '/', origin: 'https://example.test',
    })
    const head = extension?.head?.({
      command: 'build', mode: 'production', root: '/site', base: '/', origin: 'https://example.test',
      route: {
        kind: 'page', path: '/post/', source: 'test', status: 200,
        meta: {
          title: 'Post', description: 'Body',
          image: { src: '/cover.png', width: 1200, height: 630, type: 'image/png', alt: 'Cover' },
        },
      },
    })
    const contentByKey = new Map<string, string | number | boolean>()
    for (const element of (head?.elements ?? []).filter((entry) => entry.tag === 'meta')) {
      const attrs = element.attributes
      if (attrs === undefined) continue
      const key = String(attrs.property ?? attrs.name)
      if (attrs.content !== undefined) contentByKey.set(key, attrs.content)
    }
    expect(contentByKey.get('og:image')).toBe('https://example.test/cover.png')
    expect(contentByKey.get('og:image:width')).toBe(1200)
    expect(contentByKey.get('og:image:height')).toBe(630)
    expect(contentByKey.get('og:image:type')).toBe('image/png')
    expect(contentByKey.get('og:image:alt')).toBe('Cover')
    expect(contentByKey.get('twitter:image')).toBe('https://example.test/cover.png')
  })
})
