import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { markdownMedia } from '../src/framework/markdown-media'
import { markdownToCompiledPage } from '../src/framework/markdown'
import { hostingArtifacts } from '../src/framework/hosting'
import { writeHostingArtifacts } from '../src/framework/hosting-writer'
import { createPublicationManifest } from '../src/framework/publication'
import { verifySite } from '../src/framework/verify'
import { metadata } from '../src/metadata'
import { search } from '../src/search'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

function pageOutput(html = '<title>Page</title>') {
  return {
    kind: 'page' as const,
    page: { status: 200, head: '', html, islands: [] },
  }
}

describe('publication integrations', () => {
  it('generates hosting companions from one trailing-slash manifest', async () => {
    const manifest = createPublicationManifest('/docs/', 'always', [
      { routePath: '/', artifact: 'index.html', output: pageOutput() },
      { routePath: '/about/', artifact: 'about/index.html', output: pageOutput() },
      {
        routePath: '/feed.xml',
        artifact: 'feed.xml',
        output: { kind: 'resource' as const, status: 200, body: '', contentType: 'application/xml' },
      },
      {
        routePath: '/old/',
        artifact: 'old/index.html',
        output: { kind: 'redirect' as const, status: 301, destination: '/about/' },
      },
    ])

    expect(hostingArtifacts(manifest, 'netlify')[0]?.body).toContain('/docs/about /docs/about/ 301!')
    expect(hostingArtifacts(manifest, 'vercel')[0]?.body).toContain('"permanent": true')
    expect(hostingArtifacts(manifest, 'cloudflare')).toEqual([
      expect.objectContaining({ path: '_redirects' }),
      expect.objectContaining({ path: '_headers', body: expect.stringContaining('Cache-Control') }),
    ])
    expect(hostingArtifacts(manifest, 's3')[0]?.body).toContain('"trailingSlash": "always"')
    expect(hostingArtifacts({ ...manifest, trailingSlash: 'ignore' }, 'netlify')[0]?.body).toBe('\n')

    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-hosting-'))
    temporaryDirectories.push(output)
    await writeHostingArtifacts(output, manifest, {
      adapters: ['netlify', 'vercel', 'cloudflare', 's3'],
    })
    await expect(fs.access(path.join(output, '_redirects'))).resolves.toBeUndefined()
    await expect(fs.access(path.join(output, '_headers'))).resolves.toBeUndefined()
    await expect(fs.access(path.join(output, 'vercel.json'))).resolves.toBeUndefined()
    await expect(fs.access(path.join(output, 's3-website.json'))).resolves.toBeUndefined()
  })

  it('contributes canonical social metadata with and without a deployed origin', async () => {
    const plugin = metadata({
      image: '/social.png',
      siteName: 'Nib',
      type: 'article',
      structuredData: true,
    })
    const extension = await plugin.renderer?.({
      command: 'build', mode: 'production', root: '/site', base: '/docs/',
      site: { title: 'Nib', origin: 'https://example.test' },
    })
    const head = extension?.head?.({
      command: 'build', mode: 'production', root: '/site', base: '/docs/',
      site: { title: 'Nib', origin: 'https://example.test' },
      route: {
        kind: 'page', path: '/article/', source: 'test', status: 200,
        meta: { title: 'Article', description: 'Description' },
      },
    })
    const serialized = JSON.stringify(head)
    expect(serialized).toContain('https://example.test/docs/article/')
    expect(serialized).toContain('https://example.test/docs/social.png')
    expect(serialized).toContain('application/ld+json')

    const absolute = metadata({ image: 'https://cdn.example/social.png', structuredData: false })
    const absoluteExtension = await absolute.renderer?.({
      command: 'build', mode: 'production', root: '/site', base: '/',
      site: { title: 'Nib' },
    })
    const absoluteHead = absoluteExtension?.head?.({
      command: 'build', mode: 'production', root: '/site', base: '/', site: { title: 'Nib' },
      route: { kind: 'page', path: '/', source: 'test', status: 200, meta: { title: 'Home', description: '' } },
    })
    expect(JSON.stringify(absoluteHead)).toContain('https://cdn.example/social.png')
    const noOriginExtension = await metadata({ image: '/relative.png' }).renderer?.({
      command: 'build', mode: 'production', root: '/site', base: '/', site: { title: 'Nib' },
    })
    expect(() => noOriginExtension?.head?.({
      command: 'build', mode: 'production', root: '/site', base: '/', site: { title: 'Nib' },
      route: { kind: 'page', path: '/', source: 'test', status: 200, meta: { title: 'Home', description: '' } },
    })).toThrow('site.origin')
  })

  it('emits deterministic search resources from page fallbacks and custom items', async () => {
    const context = {
      command: 'build' as const,
      mode: 'production' as const,
      root: '/site',
      base: '/',
      site: { title: 'Site' },
      routes: [
        { kind: 'page' as const, path: '/', source: 'home', status: 200, meta: { title: 'Home', description: 'Start' } },
        { kind: 'page' as const, path: '/draft', source: 'draft', status: 404, meta: { title: 'Draft', description: '' } },
        { kind: 'resource' as const, path: '/feed.xml', source: 'feed', status: 200, contentType: 'application/xml' },
      ],
    }
    const fallback = await search().routes?.(context)
    expect(fallback).toMatchObject({ kind: 'resource', path: '/search.json', contentType: 'application/json; charset=utf-8' })
    expect(JSON.parse((fallback as { body: string }).body).items).toEqual([
      { title: 'Home', description: 'Start', href: '/' },
    ])

    const custom = await search({
      path: '/lookup.json',
      items: async () => [{ title: 'One', href: '/one', tags: ['tag'], kind: 'page', text: 'body' }],
    }).routes?.(context)
    expect(JSON.parse((custom as { body: string }).body).items[0]).toEqual({
      title: 'One', href: '/one', tags: ['tag'], kind: 'page', text: 'body',
    })
    expect(() => search({ path: 'lookup.json' })).toThrow('absolute route path')
    const invalid = search({ items: [{ title: '', href: '/bad' }] })
    await expect(invalid.routes?.(context)).rejects.toThrow('title must be non-empty')
    const invalidHref = search({ items: [{ title: 'Bad', href: 'javascript:bad' }] })
    await expect(invalidHref.routes?.(context)).rejects.toThrow('href must be an absolute route')
  })

  it('converts explicitly trusted Markdown media and rejects other iframe hosts', () => {
    const compiled = markdownToCompiledPage(
      '# Media\n\n![autoplay](/videos/demo.mp4)\n\n<iframe src="https://www.youtube.com/embed/demo"></iframe>',
      {
        allowDangerousHtml: true,
        rehypePlugins: [markdownMedia({ iframeHosts: ['www.youtube.com'] })],
      },
    )
    expect(compiled.html).toContain('<video')
    expect(compiled.html).toContain('controls')
    expect(compiled.html).toContain('https://www.youtube.com/embed/demo')

    const disallowed = markdownToCompiledPage(
      '<iframe src="https://evil.example/embed"></iframe>',
      {
        allowDangerousHtml: true,
        rehypePlugins: [markdownMedia({ iframeHosts: ['www.youtube.com'] })],
      },
    )
    expect(disallowed.html).not.toContain('<iframe')

    const transform = (markdownMedia({ iframeHosts: ['youtube.com'] }) as () => (tree: any) => void)()
    const tree = {
      children: [{
        type: 'element', tagName: 'div', properties: {}, children: [
          { type: 'element', tagName: 'img', properties: { src: '/__nib-embed__/https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3D1' }, children: [] },
          { type: 'element', tagName: 'img', properties: { src: '/__nib-embed__/https%3A%2F%2Fevil.example%2Fx' }, children: [] },
        ],
      }],
    }
    transform(tree)
    expect(tree.children[0].children[0].tagName).toBe('iframe')
    expect(tree.children[0].children[1].tagName).toBe('img')
  })

  it('checks publication artifacts, links, titles, and island ownership', async () => {
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-check-'))
    temporaryDirectories.push(output)
    const manifest = createPublicationManifest('/', 'never', [
      { routePath: '/', artifact: 'index.html', output: pageOutput() },
      { routePath: '/about', artifact: 'about', output: pageOutput() },
      {
        routePath: '/feed.xml', artifact: 'feed.xml',
        output: { kind: 'resource' as const, status: 200, body: '<feed />', contentType: 'application/xml' },
      },
      {
        routePath: '/old', artifact: 'old',
        output: { kind: 'redirect' as const, status: 301, destination: '/about' },
      },
    ])
    await fs.mkdir(path.join(output, '.nib'), { recursive: true })
    await fs.writeFile(path.join(output, '.nib/publication.json'), JSON.stringify(manifest))
    await fs.writeFile(path.join(output, 'index.html'), '<title>Home</title><a href="/about?x=1">About</a><a href="/feed.xml">Feed</a><a href="/assets/a">Image</a><img src="/assets/a"><script data-nib-islands src="/assets/islands.js"></script><nib-island></nib-island>')
    await fs.writeFile(path.join(output, 'about'), '<title>About</title>')
    await fs.writeFile(path.join(output, 'feed.xml'), '<feed />')
    await fs.writeFile(path.join(output, 'old'), '<title>Redirect</title>')
    const result = await verifySite({ root: output, output })
    expect(result.routeCount).toBe(4)
    expect(result.checkedLinks).toBe(3)
    expect(result.warnings).toEqual(['/: 1 image(s) missing alt text'])

    await fs.writeFile(path.join(output, 'index.html'), '<title>Home</title><a href="/missing">Missing</a>')
    await expect(verifySite({ root: output, output })).rejects.toThrow('Broken internal link')
    await fs.writeFile(path.join(output, 'index.html'), '<title>Home</title><script data-nib-islands src="/assets/islands.js"></script>')
    await expect(verifySite({ root: output, output })).rejects.toThrow('island runtime without an island')
  })
})
