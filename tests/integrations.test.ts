import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { markdownMedia } from '../src/integrations/markdown-media'
import { markdownToCompiledPage } from '../src/framework/markdown'
import { hostingArtifacts } from '../src/framework/hosting'
import { writeHostingArtifacts } from '../src/framework/hosting-writer'
import { createPublicationManifest } from '../src/framework/publication'
import {
  inspectSite,
  SiteVerificationError,
  verifySite,
} from '../src/framework/verify'
import { metadata } from '../src/integrations/metadata'
import { search } from '../src/integrations/search'
import { siteMetadata } from '../src/integrations/site-metadata'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

function pageOutput(html = '<title>Page</title>') {
  return {
    kind: 'page' as const,
    page: { status: 200, head: '', html, islands: [], behaviors: [] },
  }
}

describe('publication integrations', () => {
  it('applies optional site metadata without owning page metadata', async () => {
    const plugin = siteMetadata({
      title: 'Nib',
      description: 'Site description',
      titleTemplate: '%s | Nib',
      head: {
        elements: [{
          tag: 'link',
          attributes: { rel: 'alternate', href: '/rss.xml' },
        }],
      },
    })
    const extension = await plugin.renderer?.({
      command: 'build', mode: 'production', root: '/site', base: '/',
    })
    const home = extension?.head?.({
      command: 'build', mode: 'production', root: '/site', base: '/',
      route: {
        kind: 'page', path: '/', source: 'test', status: 200,
        meta: { title: 'Home' },
      },
    })
    const page = extension?.head?.({
      command: 'build', mode: 'production', root: '/site', base: '/',
      route: {
        kind: 'page', path: '/docs/', source: 'test', status: 200,
        meta: { title: 'Docs', description: 'Page description' },
      },
    })

    expect(home).toMatchObject({
      title: 'Nib',
      description: 'Site description',
      elements: [{ tag: 'link' }],
    })
    expect(page).toMatchObject({ title: 'Docs | Nib' })
    expect(page).not.toHaveProperty('description')
    expect(() => siteMetadata({ title: '' })).toThrow('non-empty')
    expect(() => siteMetadata({ title: 'Nib', titleTemplate: 'Nib' }))
      .toThrow('exactly one')
    expect(() => siteMetadata({
      title: 'Nib',
      // @ts-expect-error title overrides belong to the typed site metadata fields.
      head: { title: 'Wrong seam' },
    })).toThrow('only structured elements')
  })

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

    expect(hostingArtifacts(manifest, 'netlify')[0]?.body).toContain('/docs/old/ /about/ 301!')
    expect(hostingArtifacts(manifest, 'vercel')[0]?.body).toContain('"statusCode": 301')
    const cloudflare = hostingArtifacts(manifest, 'cloudflare')
    expect(cloudflare[0]?.body).toContain('/docs/about /docs/about/ 301')
    expect(cloudflare).toEqual([
      expect.objectContaining({ path: '_redirects' }),
      expect.objectContaining({ path: '_headers', body: expect.stringContaining('Cache-Control') }),
    ])
    expect(hostingArtifacts(manifest, 's3')[0]?.body).toContain('"trailingSlash": "always"')
    expect(hostingArtifacts({ ...manifest, trailingSlash: 'ignore' }, 'netlify')[0]?.body)
      .toBe('/docs/old/ /about/ 301!\n')

    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-hosting-'))
    temporaryDirectories.push(output)
    await writeHostingArtifacts(output, manifest, {
      adapters: ['cloudflare', 'vercel', 's3'],
    })
    for (const artifact of ['_redirects', '_headers', 'vercel.json', 's3-website.json']) {
      await fs.access(path.join(output, artifact))
    }
    await expect(writeHostingArtifacts(output, manifest, {
      adapters: ['netlify', 'cloudflare'],
    })).rejects.toThrow(
      'Hosting adapters netlify and cloudflare both own _redirects with incompatible contents',
    )
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
      origin: 'https://example.test',
    })
    const head = extension?.head?.({
      command: 'build', mode: 'production', root: '/site', base: '/docs/',
      origin: 'https://example.test',
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
    })
    const absoluteHead = absoluteExtension?.head?.({
      command: 'build', mode: 'production', root: '/site', base: '/',
      route: { kind: 'page', path: '/', source: 'test', status: 200, meta: { title: 'Home', description: '' } },
    })
    expect(JSON.stringify(absoluteHead)).toContain('https://cdn.example/social.png')
    const noOriginExtension = await metadata({ image: '/relative.png' }).renderer?.({
      command: 'build', mode: 'production', root: '/site', base: '/',
    })
    expect(() => noOriginExtension?.head?.({
      command: 'build', mode: 'production', root: '/site', base: '/',
      route: { kind: 'page', path: '/', source: 'test', status: 200, meta: { title: 'Home', description: '' } },
    })).toThrow('configured origin')
  })

  it('applies route-level image, type, and twitter card overrides independently', async () => {
    const plugin = metadata({
      image: '/default-social.png',
      type: 'website',
      twitterCard: 'summary',
      siteName: 'Nib',
      structuredData: true,
    })
    const extension = await plugin.renderer?.({
      command: 'build', mode: 'production', root: '/site', base: '/',
      origin: 'https://example.test',
    })

    // Full override: every route value wins and structured data follows the route type.
    const overriddenHead = extension?.head?.({
      command: 'build', mode: 'production', root: '/site', base: '/',
      origin: 'https://example.test',
      route: {
        kind: 'page', path: '/article/', source: 'test', status: 200,
        meta: {
          title: 'Route Override', description: 'Override body',
          image: '/route-social.png',
          type: 'article',
          twitterCard: 'summary_large_image',
        },
      },
    })
    const overridden = JSON.stringify(overriddenHead)
    expect(overridden).toContain('{"property":"og:image","content":"https://example.test/route-social.png"}')
    expect(overridden).not.toContain('default-social.png')
    expect(overridden).toContain('{"property":"og:type","content":"article"}')
    expect(overridden).not.toContain('{"property":"og:type","content":"website"}')
    expect(overridden).toContain('{"name":"twitter:card","content":"summary_large_image"}')
    expect(overridden).not.toContain('{"name":"twitter:card","content":"summary"}')
    const overriddenStructured = JSON.parse(
      (overriddenHead?.elements ?? []).find((element) => element.tag === 'script')?.content ?? '{}',
    )
    expect(overriddenStructured['@type']).toBe('Article')

    // Independent fallback: an unset field keeps its plugin default.
    const partial = JSON.stringify(extension?.head?.({
      command: 'build', mode: 'production', root: '/site', base: '/',
      origin: 'https://example.test',
      route: {
        kind: 'page', path: '/page/', source: 'test', status: 200,
        meta: { title: 'Plain Page', description: 'Plain body', type: 'article' },
      },
    }))
    expect(partial).toContain('{"property":"og:type","content":"article"}')
    expect(partial).toContain('{"property":"og:image","content":"https://example.test/default-social.png"}')
    expect(partial).toContain('{"name":"twitter:card","content":"summary"}')
  })

  it('emits deterministic search resources from page fallbacks and custom items', async () => {
    const context = {
      command: 'build' as const,
      mode: 'production' as const,
      root: '/site',
      base: '/',
      readCollection: () => {
        throw new Error('No collection capability configured')
      },
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

  it('converts explicitly trusted Markdown media and rejects other iframe hosts', async () => {
    const compiled = await markdownToCompiledPage(
      '---\ntitle: Media\n---\n\n# Media\n\n![autoplay](/videos/demo.mp4)\n\n<iframe src="https://www.youtube.com/embed/demo"></iframe>',
      {
        allowDangerousHtml: true,
        rehypePlugins: [markdownMedia({ iframeHosts: ['www.youtube.com'] })],
      },
    )
    expect(compiled.html).toContain('<video')
    expect(compiled.html).toContain('controls')
    expect(compiled.html).toContain('https://www.youtube.com/embed/demo')

    const disallowed = await markdownToCompiledPage(
      '---\ntitle: Disallowed media\n---\n\n<iframe src="https://evil.example/embed"></iframe>',
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

  it('preserves safe iframe presentation and permission attributes exactly', async () => {
    const compiled = await markdownToCompiledPage(
      '---\ntitle: Embedded video\n---\n\n'
      + '<iframe width="515" height="915" src="https://www.youtube.com/embed/demo" '
      + 'title="Hydrofoil Surfing" loading="lazy" frameborder="0" '
      + 'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '
      + 'allowfullscreen style="max-width: 600px; border-radius: 8px;"></iframe>',
      {
        allowDangerousHtml: true,
        rehypePlugins: [markdownMedia({ iframeHosts: ['www.youtube.com'] })],
      },
    )

    expect(compiled.html).toContain('width="515"')
    expect(compiled.html).toContain('height="915"')
    expect(compiled.html).toContain('title="Hydrofoil Surfing"')
    expect(compiled.html).toContain('loading="lazy"')
    expect(compiled.html).toContain('frameborder="0"')
    expect(compiled.html).toContain(
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"',
    )
    expect(compiled.html).toContain('allowfullscreen')
    expect(compiled.html).toContain('style="max-width: 600px; border-radius: 8px;"')

    const withoutFullscreen = await markdownToCompiledPage(
      '---\ntitle: Video without fullscreen\n---\n\n'
      + '<iframe src="https://www.youtube.com/embed/demo" title="No fullscreen"></iframe>',
      {
        allowDangerousHtml: true,
        rehypePlugins: [markdownMedia({ iframeHosts: ['www.youtube.com'] })],
      },
    )
    expect(withoutFullscreen.html).not.toContain('allowfullscreen')
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
    await fs.writeFile(path.join(output, 'index.html'), '<title>Home</title><a href="/about?x=1">About</a><a href="/feed.xml">Feed</a><a href="/assets/a">Image</a><img src="/assets/a" srcset="data:image/svg+xml,%3Csvg%3E 1x, /assets/a 2x"><script data-nib-islands src="/assets/islands.js"></script><nib-island></nib-island>')
    await fs.writeFile(path.join(output, 'about'), '<title>About</title>')
    await fs.writeFile(path.join(output, 'feed.xml'), '<feed />')
    await fs.writeFile(path.join(output, 'old'), '<title>Redirect</title>')
    await fs.mkdir(path.join(output, 'assets'))
    await fs.writeFile(path.join(output, 'assets/a'), 'image')
    await fs.writeFile(path.join(output, 'assets/islands.js'), 'runtime')
    const result = await verifySite({ root: output, output })
    expect(result.routeCount).toBe(4)
    expect(result.checkedLinks).toBe(6)
    expect(result.warnings).toEqual(['/: 1 image(s) missing alt text'])

    await fs.writeFile(
      path.join(output, 'index.html'),
      '<div id="first" id="second"><a href="/missing">Missing</a><img src="/also-missing"><script data-nib-islands src="/assets/islands.js"></script></div>',
    )
    const inspection = await inspectSite({ root: output, output })
    expect(inspection.issues.map((issue) => issue.code)).toEqual([
      'HTML_PARSE_ERROR',
      'IMAGE_ALT_MISSING',
      'ISLAND_RUNTIME_UNUSED',
      'LOCAL_REFERENCE_MISSING',
      'LOCAL_REFERENCE_MISSING',
      'TITLE_COUNT',
    ])
    expect(Object.isFrozen(inspection)).toBe(true)
    expect(Object.isFrozen(inspection.pages[0]?.document.elements)).toBe(true)

    const failure = await verifySite({ root: output, output }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(SiteVerificationError)
    expect((failure as SiteVerificationError).result.issues).toHaveLength(6)
  })

  it('rejects malformed manifests and references outside a configured base', async () => {
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-check-base-'))
    temporaryDirectories.push(output)
    await fs.mkdir(path.join(output, '.nib'), { recursive: true })
    await fs.mkdir(path.join(output, 'assets'))
    await fs.mkdir(path.join(output, 'guide'))
    await fs.writeFile(path.join(output, 'assets/app.js'), '')
    await fs.writeFile(
      path.join(output, 'index.html'),
      '<title>Home</title><script src="/assets/app.js"></script>',
    )
    await fs.writeFile(
      path.join(output, 'guide/index.html'),
      '<title>Guide</title><script src="../../assets/app.js"></script>',
    )
    const manifest = createPublicationManifest('/docs/', 'never', [
      { routePath: '/', artifact: 'index.html', output: pageOutput() },
      { routePath: '/guide', artifact: 'guide/index.html', output: pageOutput() },
    ])
    await fs.writeFile(
      path.join(output, '.nib/publication.json'),
      JSON.stringify(manifest),
    )

    const basedInspection = await inspectSite({ root: output, output })
    expect(basedInspection.issues).toContainEqual(expect.objectContaining({
      code: 'LOCAL_REFERENCE_OUTSIDE_BASE',
      reference: '/assets/app.js',
    }))
    expect(basedInspection.issues).toContainEqual(expect.objectContaining({
      code: 'LOCAL_REFERENCE_OUTSIDE_BASE',
      reference: '../../assets/app.js',
    }))

    await fs.writeFile(
      path.join(output, '.nib/publication.json'),
      JSON.stringify({ ...manifest, base: 'docs', trailingSlash: 'sometimes' }),
    )
    const malformedInspection = await inspectSite({ root: output, output })
    expect(malformedInspection.issues).toContainEqual(expect.objectContaining({
      code: 'MANIFEST_INVALID',
    }))
  })
})
