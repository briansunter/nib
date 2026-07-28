import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  buildSite,
  manifestModulePreloads,
} from '../src/framework/site'

const root = path.resolve('tests/fixtures/basic-site')
const output = path.join(root, 'dist')
const publicSentinel = path.join(root, 'public/ssr-copy-sentinel.txt')
const publicCollisionDirectory = path.join(root, 'public/about')
const preservedOutputSentinel = path.join(output, 'preserved-output.txt')

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
  owner: 'islands' | 'behaviors' | 'enhancements',
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

afterAll(async () => {
  await fs.rm(output, { recursive: true, force: true })
  await fs.rm(publicSentinel, { force: true })
  await fs.rm(publicCollisionDirectory, { recursive: true, force: true })
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

  it('prerenders a consumer project without consumer-owned framework files', async () => {
    await fs.mkdir(path.dirname(publicSentinel), { recursive: true })
    await fs.writeFile(publicSentinel, 'client only')
    await buildSite({ root })

    const home = await fs.readFile(path.join(output, 'client/index.html'), 'utf8')
    const about = await fs.readFile(path.join(output, 'client/about/index.html'), 'utf8')
    const enhanced = await fs.readFile(path.join(output, 'client/enhanced/index.html'), 'utf8')
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
    const viteManifest = JSON.parse(await fs.readFile(
      path.join(output, 'client/.vite/manifest.json'),
      'utf8',
    )) as Record<string, BuildManifestEntry>

    expect(home).toContain('<title>Home | Journal</title>')
    expect(home).toMatch(/<link rel="stylesheet" href="\/journal\/assets\/[^"]+\.css" \/>/)
    expect(home).toContain('data-site="Journal"')
    expect(home).toContain('data-island="counter"')
    expect(home).toContain('Count:')
    expect(home).toContain('>2</button>')
    expect(home).toContain('First typed post')
    expect(home).toContain('2026-07-18T00:00:00.000Z')
    expect(home).toContain('/journal/assets/')
    expect(about).toContain('<h1>About the journal</h1>')
    expect(about).toContain('<section data-eyebrow="Company">')
    expect(about).not.toContain('data-nib-islands')
    expect(about).not.toContain('data-nib-behaviors')
    expect(about).not.toContain('data-nib-enhancements')
    expect(enhanced).toContain('data-behavior="reveal"')
    expect(enhanced).toContain('data-nib-behaviors')
    expect(enhanced).not.toContain('data-nib-islands')
    const revealEntry = Object.values(viteManifest)
      .find((entry) => entry.src?.endsWith('/behaviors/reveal.client.ts'))
    expect(revealEntry?.isDynamicEntry).toBe(true)
    expect(revealEntry?.css).toHaveLength(1)
    for (const stylesheet of revealEntry?.css ?? []) {
      expect(home).not.toContain(stylesheet)
      expect(about).not.toContain(stylesheet)
      expect(enhanced).not.toContain(stylesheet)
    }
    const behaviorEntry = Object.values(viteManifest)
      .find((entry) => entry.name === 'behaviors')
    expect(behaviorEntry).toBeDefined()
    const islandEntry = Object.values(viteManifest)
      .find((entry) => entry.name === 'islands')
    expect(islandEntry).toBeDefined()
    const islandPreloads = manifestModulePreloads(viteManifest, islandEntry!)
      .map((file) => `/journal/${file}`)
    const behaviorPreloads = manifestModulePreloads(viteManifest, behaviorEntry!)
      .map((file) => `/journal/${file}`)
    expect(islandPreloads.length).toBeGreaterThan(0)
    expect(behaviorPreloads.length).toBeGreaterThan(0)
    expect(runtimePreloads(home, 'islands')).toEqual(islandPreloads)
    expect(runtimePreloads(home, 'behaviors')).toEqual([])
    expect(runtimePreloads(enhanced, 'behaviors')).toEqual(behaviorPreloads)
    expect(runtimePreloads(enhanced, 'islands')).toEqual([])
    expect(runtimePreloads(about, 'islands')).toEqual([])
    expect(runtimePreloads(about, 'behaviors')).toEqual([])
    for (const id of islandEntry!.dynamicImports ?? []) {
      const islandDependency = viteManifest[id]
      expect(islandDependency).toBeDefined()
      expect(enhanced).not.toContain(islandDependency!.file)
      expect(about).not.toContain(islandDependency!.file)
    }
    const behaviorFiles = [
      behaviorEntry!.file,
      ...(behaviorEntry!.imports ?? []).map((id) => viteManifest[id]!.file),
    ]
    const behaviorJavaScript = (await Promise.all(
      behaviorFiles.map((file) => fs.readFile(path.join(output, 'client', file), 'utf8')),
    )).join('\n')
    expect(behaviorJavaScript).not.toMatch(/react-dom|hydrateRoot|createRoot/)
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
    expect(publication.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: '/about/',
        artifact: 'about/index.html',
        contentType: 'text/html; charset=utf-8',
      }),
      expect.objectContaining({ path: '/enhanced/', artifact: 'enhanced/index.html' }),
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
        'export default {}',
      )

      await expect(buildSite({ root: temporaryRoot })).rejects.toThrow(
        'nib.config.ts must export an object with a site configuration',
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
