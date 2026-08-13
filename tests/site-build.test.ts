import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  buildSite,
  manifestModulePreloads,
  routeClientAssets,
} from '../src/framework/site'
import { copyFixture, removeFixture } from './helpers/fixtures'

let root: string
let output: string
let publicSentinel: string
let publicCollisionDirectory: string
let preservedOutputSentinel: string

interface BuildManifestEntry {
  css?: string[]
  dynamicImports?: string[]
  file: string
  imports?: string[]
  isDynamicEntry?: boolean
  name?: string
  src?: string
}

function runtimePreloads(
  html: string,
  owner: 'enhancements' | 'islands' | 'client',
): string[] {
  const tags = html.match(
    new RegExp(`<link\\b[^>]*data-nib-runtime-preload="${owner}"[^>]*>`, 'g'),
  ) ?? []
  return tags.map((tag) => {
    const href = tag.match(/\bhref="([^"]+)"/)?.[1]
    if (href === undefined) throw new Error(`Runtime preload is missing href: ${tag}`)
    return href
  })
}

function allRuntimePreloads(html: string): string[] {
  return ['enhancements', 'islands', 'client']
    .flatMap((owner) => runtimePreloads(
      html,
      owner as 'enhancements' | 'islands' | 'client',
    ))
}

beforeAll(async () => {
  root = await copyFixture('basic-site')
  output = path.join(root, 'dist')
  publicSentinel = path.join(root, 'public/ssr-copy-sentinel.txt')
  publicCollisionDirectory = path.join(root, 'public/about')
  preservedOutputSentinel = path.join(output, 'preserved-output.txt')
})

afterAll(async () => {
  await removeFixture(root)
})

describe('framework-owned site builds', () => {
  it('walks manifest imports recursively without duplicating shared modules', () => {
    const manifest = {
      entry: {
        file: 'entry.js',
        imports: ['shared', 'feature'],
        dynamicImports: ['lazy'],
      },
      shared: { file: 'shared.js', imports: ['runtime'] },
      feature: { file: 'feature.js', imports: ['runtime'] },
      runtime: { file: 'runtime.js', imports: ['entry'] },
      lazy: { file: 'lazy.js' },
    }
    expect(manifestModulePreloads(manifest, manifest.entry)).toEqual([
      'shared.js',
      'runtime.js',
      'feature.js',
    ])
    expect(() => manifestModulePreloads(
      manifest,
      { file: 'broken.js', imports: ['missing'] },
    )).toThrow('references missing module missing')
  })

  it('preloads transitive imports only for immediately mounted route modules', () => {
    const links = routeClientAssets({
      status: 200,
      head: '',
      html: '',
      enhancements: [
        { id: 'immediate', when: 'load' },
        { id: 'deferred', when: 'visible' },
      ],
      islands: [{ id: 'visible-island', when: 'visible' }],
    }, new Map([
      ['immediate', {
        preloads: [
          'assets/immediate.js',
          'assets/shared.js',
          'assets/immediate-dependency.js',
        ],
        stylesheets: ['assets/immediate.css'],
      }],
      ['deferred', {
        preloads: ['assets/deferred.js', 'assets/deferred-dependency.js'],
        stylesheets: ['assets/deferred.css'],
      }],
    ]), new Map([
      ['visible-island', {
        preloads: [
          'assets/visible-island.js',
          'assets/visible-island-dependency.js',
        ],
        stylesheets: ['assets/visible-island.css'],
      }],
    ]), new Set(['/journal/assets/shared.js']), '/journal/')

    expect(links).toContain('href="/journal/assets/immediate.css"')
    expect(links).toContain('href="/journal/assets/deferred.css"')
    expect(links).toContain('href="/journal/assets/visible-island.css"')
    expect(links).toContain('href="/journal/assets/immediate.js"')
    expect(links).toContain('href="/journal/assets/immediate-dependency.js"')
    expect(links).not.toContain('href="/journal/assets/shared.js"')
    expect(links).not.toContain('href="/journal/assets/deferred.js"')
    expect(links).not.toContain('href="/journal/assets/deferred-dependency.js"')
    expect(links).not.toContain('href="/journal/assets/visible-island.js"')
    expect(links).not.toContain('href="/journal/assets/visible-island-dependency.js"')
  })

  it('dedupes against active runtime preloads without suppressing inactive-owner imports', () => {
    const links = routeClientAssets({
      status: 200,
      head: '',
      html: '',
      enhancements: [],
      islands: [{ id: 'counter', when: 'load' }],
    }, new Map(), new Map([
      ['counter', {
        preloads: [
          'assets/counter.js',
          'assets/active-island-runtime.js',
          'assets/inactive-enhancement-runtime.js',
        ],
        stylesheets: [],
      }],
    ]), new Set(), '/journal/', {
      enhancements: ['/journal/assets/inactive-enhancement-runtime.js'],
      islands: ['/journal/assets/active-island-runtime.js'],
    })

    expect(links).toContain('href="/journal/assets/counter.js"')
    expect(links).not.toContain('href="/journal/assets/active-island-runtime.js"')
    expect(links).toContain('href="/journal/assets/inactive-enhancement-runtime.js"')
  })

  it('prerenders a consumer project without consumer-owned framework files', async () => {
    await fs.mkdir(path.dirname(publicSentinel), { recursive: true })
    await fs.writeFile(publicSentinel, 'client only')
    await buildSite({ root })

    const home = await fs.readFile(path.join(output, 'client/index.html'), 'utf8')
    const about = await fs.readFile(path.join(output, 'client/about/index.html'), 'utf8')
    const enhanced = await fs.readFile(path.join(output, 'client/enhanced/index.html'), 'utf8')
    const island = await fs.readFile(path.join(output, 'client/island/index.html'), 'utf8')
    const team = await fs.readFile(path.join(output, 'client/team/index.html'), 'utf8')
    const pencil = await fs.readFile(
      path.join(output, 'client/products/pencil/index.html'),
      'utf8',
    )
    const notebook = await fs.readFile(
      path.join(output, 'client/products/notebook/index.html'),
      'utf8',
    )
    const settings = await fs.readFile(
      path.join(output, 'client/settings/index.html'),
      'utf8',
    )
    const virtual = await fs.readFile(
      path.join(output, 'client/virtual/index.html'),
      'utf8',
    )
    const sitemap = await fs.readFile(
      path.join(output, 'client/sitemap.xml'),
      'utf8',
    )
    const rss = await fs.readFile(path.join(output, 'client/rss.xml'), 'utf8')
    const redirect = await fs.readFile(
      path.join(output, 'client/legacy/index.html'),
      'utf8',
    )
    const notFound = await fs.readFile(path.join(output, 'client/404.html'), 'utf8')
    expect(await fs.readFile(
      path.join(output, 'client/ssr-copy-sentinel.txt'),
      'utf8',
    )).toBe('client only')
    await expect(fs.access(
      path.join(output, 'server/ssr-copy-sentinel.txt'),
    )).rejects.toMatchObject({ code: 'ENOENT' })
    const publication = JSON.parse(await fs.readFile(
      path.join(output, 'client/.nib/publication.json'),
      'utf8',
    )) as {
      version: number
      base: string
      trailingSlash: string
      routes: Array<{ path: string; artifact: string; contentType: string }>
    }
    const clientProvenance = JSON.parse(await fs.readFile(
      path.join(output, 'client/.nib/client.json'),
      'utf8',
    )) as {
      version: number
      routes: Array<{
        path: string
        artifact: string
        enhancements: Array<{ id: string; when: string }>
        islands: Array<{ id: string; when: string }>
      }>
    }
    const viteManifest = JSON.parse(await fs.readFile(
      path.join(output, 'client/.vite/manifest.json'),
      'utf8',
    )) as Record<string, BuildManifestEntry>

    expect(home).toContain('<title>Home</title>')
    expect(home).toMatch(/<link rel="stylesheet" href="\/journal\/assets\/[^"]+\.css" \/>/)
    expect(home).toContain('data-site="Journal"')
    expect(home).toContain('>Count: 2</button>')
    expect(home).not.toContain('data-nib-enhancements')
    expect(home).not.toContain('data-nib-islands')
    expect(home).toContain('First typed post')
    expect(home).toContain('2026-07-18T00:00:00.000Z')
    expect(home).toContain('/journal/assets/')
    expect(about).toContain('<h1>About the journal</h1>')
    expect(about).toContain('<section data-eyebrow="Company">')
    expect(about).not.toContain('data-nib-enhancements')
    expect(about).not.toContain('data-nib-islands')
    expect(enhanced).toContain('data-nib-enhancement="reveal"')
    expect(enhanced).toContain('data-nib-enhancement="plain"')
    expect(enhanced).toContain('data-nib-when="visible"')
    expect(enhanced).toContain('data-nib-enhancements')
    expect(enhanced).not.toContain('data-nib-islands')
    expect(island).toContain('<h1>React island</h1>')
    expect(island).toContain('data-nib-island="counter"')
    expect(island).toContain('data-nib-when="load"')
    expect(island).toContain('data-nib-props="{&quot;initialCount&quot;:3}"')
    expect(island).toMatch(/>Count: (?:<!-- -->)?3<\/button>/)
    expect(island).toContain('data-nib-islands')
    expect(island).not.toContain('data-nib-enhancements')
    const revealEntry = Object.values(viteManifest)
      .find((entry) => entry.src?.endsWith('/enhancements/reveal/index.client.ts'))
    expect(revealEntry?.isDynamicEntry).toBe(true)
    expect(revealEntry?.css).toHaveLength(1)
    for (const stylesheet of revealEntry?.css ?? []) {
      expect(home).not.toContain(stylesheet)
      expect(about).not.toContain(stylesheet)
      expect(enhanced).toContain(stylesheet)
    }
    const plainJavaScriptEntry = Object.values(viteManifest)
      .find((entry) => entry.src?.endsWith('/enhancements/plain/index.client.js'))
    expect(plainJavaScriptEntry?.isDynamicEntry).toBe(true)
    const enhancementEntry = Object.values(viteManifest)
      .find((entry) => entry.name === 'enhancements')
    expect(enhancementEntry).toBeDefined()
    const enhancementPreloads = manifestModulePreloads(viteManifest, enhancementEntry!)
      .map((file) => `/journal/${file}`)
    expect(runtimePreloads(home, 'enhancements')).toEqual([])
    expect(runtimePreloads(enhanced, 'enhancements'))
      .toEqual(expect.arrayContaining(enhancementPreloads))
    expect(runtimePreloads(enhanced, 'enhancements')).toEqual(expect.arrayContaining([
      `/journal/${revealEntry!.file}`,
      ...manifestModulePreloads(viteManifest, revealEntry!)
        .map((file) => `/journal/${file}`),
    ]))
    expect(allRuntimePreloads(enhanced)).toEqual([
      ...new Set(allRuntimePreloads(enhanced)),
    ])
    expect(runtimePreloads(enhanced, 'enhancements')).not.toContain(
      `/journal/${plainJavaScriptEntry!.file}`,
    )
    expect(runtimePreloads(about, 'enhancements')).toEqual([])
    const counterEntry = Object.values(viteManifest)
      .find((entry) => entry.src?.endsWith('/islands/counter.tsx'))
    expect(counterEntry?.isDynamicEntry).toBe(true)
    expect(counterEntry?.css).toHaveLength(1)
    for (const stylesheet of counterEntry?.css ?? []) {
      expect(home).not.toContain(stylesheet)
      expect(about).not.toContain(stylesheet)
      expect(enhanced).not.toContain(stylesheet)
      expect(island).toContain(stylesheet)
    }
    const islandEntry = Object.values(viteManifest)
      .find((entry) => entry.name === 'islands')
    expect(islandEntry).toBeDefined()
    const islandPreloads = manifestModulePreloads(viteManifest, islandEntry!)
      .map((file) => `/journal/${file}`)
    expect(runtimePreloads(home, 'islands')).toEqual([])
    expect(runtimePreloads(about, 'islands')).toEqual([])
    expect(runtimePreloads(enhanced, 'islands')).toEqual([])
    expect(runtimePreloads(island, 'islands')).toEqual(expect.arrayContaining([
      ...islandPreloads,
      `/journal/${counterEntry!.file}`,
      ...manifestModulePreloads(viteManifest, counterEntry!)
        .map((file) => `/journal/${file}`),
    ]))
    expect(allRuntimePreloads(island)).toEqual([
      ...new Set(allRuntimePreloads(island)),
    ])
    const enhancementFiles = [
      enhancementEntry!.file,
      ...(enhancementEntry!.imports ?? []).map((id) => viteManifest[id]!.file),
    ]
    const enhancementJavaScript = (await Promise.all(
      enhancementFiles.map((file) => fs.readFile(path.join(output, 'client', file), 'utf8')),
    )).join('\n')
    expect(enhancementJavaScript).not.toMatch(/react-dom|hydrateRoot|createRoot/)
    expect(team).toContain('<h1>Ada, Engineer</h1>')
    expect(pencil).toContain('<h1>Pencil</h1>')
    expect(pencil).toContain('<p>$2</p>')
    expect(notebook).toContain('<h1>Notebook</h1>')
    expect(notebook).toContain('<p>$7</p>')
    expect(settings).toContain('<h1>TOML settings: enabled</h1>')
    expect(virtual).toContain('<h1>Plugin virtual page</h1>')
    expect(sitemap).toContain('<loc>https://example.test/journal/about/</loc>')
    expect(sitemap).not.toContain('sitemap.xml')
    expect(rss).toContain('<rss version="2.0"')
    expect(rss).toContain('<link>https://example.test/journal/about/</link>')
    expect(redirect).toContain('http-equiv="refresh"')
    expect(redirect).toContain('url=/journal/about/')
    expect(notFound).toContain('Journal not found')
    expect(publication).toMatchObject({ version: 1, base: '/journal/', trailingSlash: 'always' })
    expect(clientProvenance).toMatchObject({ version: 1 })
    expect(clientProvenance.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/enhanced/', enhancements: [
        { id: 'reveal', when: 'load' },
        { id: 'plain', when: 'visible' },
      ] }),
      expect.objectContaining({ path: '/island/', islands: [{ id: 'counter', when: 'load' }] }),
    ]))
    expect(publication.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: '/about/',
        artifact: 'about/index.html',
        contentType: 'text/html; charset=utf-8',
      }),
      expect.objectContaining({ path: '/enhanced/', artifact: 'enhanced/index.html' }),
      expect.objectContaining({ path: '/island/', artifact: 'island/index.html' }),
      expect.objectContaining({
        path: '/rss.xml',
        artifact: 'rss.xml',
        contentType: 'application/rss+xml; charset=utf-8',
      }),
      expect.objectContaining({
        path: '/legacy/',
        artifact: 'legacy/index.html',
        contentType: 'text/html; charset=utf-8',
      }),
      expect.objectContaining({ path: '/404', artifact: '404.html' }),
    ]))
    await expect(fs.stat(path.join(root, 'src/framework'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  }, 30_000)

  it('runs client-target hooks through a private inert entry when a site has no client inputs', async () => {
    const staticRoot = await copyFixture('static-only-site')
    try {
      await buildSite({ root: staticRoot })
      const staticOutput = path.join(staticRoot, 'dist/client')
      const html = await fs.readFile(path.join(staticOutput, 'index.html'), 'utf8')

      expect(html).toContain('<h1>No client build required</h1>')
      expect(html).not.toContain('<script')
      expect(html).not.toContain('rel="stylesheet"')
      expect(html).not.toContain('data-nib-enhancements')
      expect(html).not.toContain('data-nib-islands')
      await expect(fs.access(path.join(staticOutput, '.vite/manifest.json')))
        .rejects.toMatchObject({ code: 'ENOENT' })
      expect(JSON.parse(await fs.readFile(
        path.join(staticOutput, '.nib/client.json'),
        'utf8',
      ))).toMatchObject({ version: 1, routes: expect.any(Array) })
      await expect(fs.access(path.join(staticOutput, 'assets')))
        .rejects.toMatchObject({ code: 'ENOENT' })
      expect(await fs.readFile(
        path.join(staticOutput, 'client-target-hook.txt'),
        'utf8',
      )).toBe('client hook ran')
    } finally {
      await removeFixture(staticRoot)
    }
  }, 30_000)

  it('preserves the previous build when public output collides with a route', async () => {
    const homeFile = path.join(output, 'client/index.html')
    const priorHome = await fs.readFile(homeFile, 'utf8')
    await fs.writeFile(preservedOutputSentinel, 'last successful build')
    await fs.mkdir(publicCollisionDirectory, { recursive: true })
    await fs.writeFile(
      path.join(publicCollisionDirectory, 'index.html'),
      'public file must not be silently overwritten',
    )

    try {
      await expect(buildSite({ root })).rejects.toThrow(
        'route "/about/" to "about/index.html" because the client build already owns that artifact',
      )
      expect(await fs.readFile(homeFile, 'utf8')).toBe(priorHome)
      expect(await fs.readFile(preservedOutputSentinel, 'utf8'))
        .toBe('last successful build')
      const buildDirectories = (await fs.readdir(root))
        .filter((file) => file.startsWith('.nib-build-') || file.startsWith('.nib-previous-'))
      expect(buildDirectories).toEqual([])
    } finally {
      await fs.rm(publicCollisionDirectory, { recursive: true, force: true })
    }

    await buildSite({ root })
    await expect(fs.access(preservedOutputSentinel)).rejects.toMatchObject({
      code: 'ENOENT',
    })
    expect(await fs.readFile(homeFile, 'utf8')).toBe(priorHome)
    expect((await fs.readdir(root)).filter((file) => (
      file.startsWith('.nib-build-') || file.startsWith('.nib-previous-')
    ))).toEqual([])
  }, 30_000)

  it('uses a sibling staging directory on the same filesystem as the project', async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-build-failure-'))
    try {
      await fs.mkdir(path.join(temporaryRoot, 'dist/client'), { recursive: true })
      await fs.writeFile(
        path.join(temporaryRoot, 'dist/client/index.html'),
        'last successful build',
      )
      await fs.writeFile(
        path.join(temporaryRoot, 'nib.config.ts'),
        'export default { unsupported: true }',
      )

      await expect(buildSite({ root: temporaryRoot })).rejects.toThrow(
        'Nib configuration has unsupported field unsupported',
      )
      expect(await fs.readFile(
        path.join(temporaryRoot, 'dist/client/index.html'),
        'utf8',
      )).toBe('last successful build')
      expect((await fs.readdir(temporaryRoot)).filter((file) => (
        file.startsWith('.nib-build-') || file.startsWith('.nib-previous-')
      ))).toEqual([])
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true })
    }
  })
})
