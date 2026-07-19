import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, describe, expect, it } from 'vitest'
import {
  buildSite,
  previewSite,
  siteViteConfig,
  startDevSite,
} from '../src/framework/site'

const root = path.resolve('tests/fixtures/image-site')

async function cacheArtifacts(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return cacheArtifacts(file)
    return entry.name.endsWith('.json') ? [] : [file]
  }))
  return nested.flat().sort()
}

async function imageRequest(origin: string): Promise<URL> {
  const response = await fetch(origin)
  const html = await response.text()
  if (response.status !== 200) throw new Error(html)
  const image = html.match(/<img[^>]+src="([^"]+)"/)
  if (!image?.[1]) throw new Error('Rendered page did not contain an image URL')
  return new URL(image[1], origin)
}

afterAll(async () => {
  await fs.rm(path.join(root, 'dist'), { recursive: true, force: true })
  await fs.rm(path.join(root, '.nib'), { recursive: true, force: true })
})

describe('optional image plugin', () => {
  it('creates isolated Vite plugin instances for client and server builds', async () => {
    const client = await siteViteConfig(root, 'build', 'client')
    const server = await siteViteConfig(root, 'build', 'server')
    const clientImagePlugin = client.config.plugins?.find((plugin) => (
      plugin !== null
      && typeof plugin === 'object'
      && !Array.isArray(plugin)
      && 'name' in plugin
      && plugin.name === '@briansunter/nib-images'
    ))
    const serverImagePlugin = server.config.plugins?.find((plugin) => (
      plugin !== null
      && typeof plugin === 'object'
      && !Array.isArray(plugin)
      && 'name' in plugin
      && plugin.name === '@briansunter/nib-images'
    ))
    expect(clientImagePlugin).toBeDefined()
    expect(serverImagePlugin).toBeDefined()
    expect(clientImagePlugin).not.toBe(serverImagePlugin)
  })

  it('serves validated optimized image requests in development', async () => {
    const server = await startDevSite({ root, host: '127.0.0.1', port: 0 })
    try {
      const origin = server.resolvedUrls?.local[0]
      if (!origin) throw new Error('Development server did not expose a local URL')
      const response = await fetch(origin)
      const html = await response.text()
      if (response.status !== 200) throw new Error(html)
      expect(html).toContain('<picture>')
      const image = html.match(/<img[^>]+src="([^"]+)"/)
      expect(image?.[1]).toBeDefined()
      expect(image?.[1]).toContain('/@nib-images/')
      const optimized = await fetch(new URL(image![1], origin))
      expect(optimized.status).toBe(200)
      expect(optimized.headers.get('content-type')).toBe('image/jpeg')
      expect(optimized.headers.get('cache-control')).toBe('no-cache')
      expect(optimized.headers.get('etag')).toBeTruthy()
      expect((await optimized.arrayBuffer()).byteLength).toBeGreaterThan(0)
      const notModified = await fetch(new URL(image![1], origin), {
        headers: { 'If-None-Match': optimized.headers.get('etag')! },
      })
      expect(notModified.status).toBe(304)
      expect((await fetch(new URL('/@nib-images/not-a-source/1-80.jpeg', origin))).status).toBe(404)
    } finally {
      await server.close()
    }
  }, 30_000)

  it('content-addresses the dev cache and refreshes optimized images through HMR', async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(path.resolve('tests'), '.image-hmr-'))
    await fs.cp(root, temporaryRoot, { recursive: true })
    await Promise.all([
      fs.rm(path.join(temporaryRoot, 'dist'), { recursive: true, force: true }),
      fs.rm(path.join(temporaryRoot, '.nib'), { recursive: true, force: true }),
    ])
    const sourceFile = path.join(temporaryRoot, 'src/hero.png')
    const server = await startDevSite({ root: temporaryRoot, host: '127.0.0.1', port: 0 })
    try {
      const origin = server.resolvedUrls?.local[0]
      if (!origin) throw new Error('Development server did not expose a local URL')
      const url = await imageRequest(origin)
      const initial = await fetch(url)
      const initialBody = Buffer.from(await initial.arrayBuffer())
      const initialEtag = initial.headers.get('etag')
      expect(initial.status).toBe(200)
      expect(initialEtag).toBeTruthy()
      expect(await cacheArtifacts(path.join(temporaryRoot, '.nib/cache/images'))).toHaveLength(1)

      const changedSource = await sharp({
        create: {
          width: 1280,
          height: 720,
          channels: 3,
          background: { r: 19, g: 113, b: 211 },
        },
      }).png().toBuffer()
      const watchedChange = new Promise<void>((resolve) => {
        server.watcher.on('change', (file) => {
          if (path.resolve(file) === path.resolve(sourceFile)) resolve()
        })
      })
      await fs.writeFile(sourceFile, changedSource)
      await Promise.race([
        watchedChange,
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error('Vite did not observe the changed image source')),
          2_000,
        )),
      ])

      let changed: Response | undefined
      const deadline = Date.now() + 5_000
      while (Date.now() < deadline) {
        const candidate = await fetch(url, {
          headers: { 'If-None-Match': initialEtag! },
        })
        if (candidate.status === 200 && candidate.headers.get('etag') !== initialEtag) {
          changed = candidate
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      expect(changed?.status).toBe(200)
      const changedBody = Buffer.from(await changed!.arrayBuffer())
      const changedEtag = changed!.headers.get('etag')
      expect(changedEtag).toBeTruthy()
      expect(changedEtag).not.toBe(initialEtag)
      expect(changedBody.equals(initialBody)).toBe(false)
      expect(await cacheArtifacts(path.join(temporaryRoot, '.nib/cache/images'))).toHaveLength(2)

      await fs.writeFile(sourceFile, changedSource)
      await new Promise((resolve) => setTimeout(resolve, 100))
      const unchanged = await fetch(url, {
        headers: { 'If-None-Match': changedEtag! },
      })
      expect(unchanged.status).toBe(304)
      expect(await cacheArtifacts(path.join(temporaryRoot, '.nib/cache/images'))).toHaveLength(2)
    } finally {
      await server.close()
      await fs.rm(temporaryRoot, { recursive: true, force: true })
    }
  }, 30_000)

  it('creates responsive static output and optimized assets without an island runtime', async () => {
    await buildSite({ root })
    const html = await fs.readFile(path.join(root, 'dist/client/index.html'), 'utf8')
    expect(html).toContain('<picture>')
    expect(html).toContain('type="image/webp"')
    expect(html).toContain('.jpeg')
    expect(html).toContain('fetchPriority="high"')
    expect(html).not.toContain('data-nib-islands')
    expect(html).not.toContain(root)
    const assets = await fs.readdir(path.join(root, 'dist/client/assets/nib'))
    expect(assets.some((asset) => asset.endsWith('.webp'))).toBe(true)
    expect(assets.some((asset) => asset.endsWith('.jpeg'))).toBe(true)
    const referencedAssets = [...html.matchAll(/\/assets\/nib\/([^"', ]+)/g)]
      .map((match) => match[1]!)
    expect(referencedAssets.length).toBeGreaterThan(0)
    for (const asset of new Set(referencedAssets)) {
      const metadata = await sharp(path.join(root, 'dist/client/assets/nib', asset)).metadata()
      const encodedWidth = Number(asset.match(/-(\d+)\.[^.]+$/)?.[1])
      expect(metadata.width).toBe(encodedWidth)
      expect(metadata.format).toBe(path.extname(asset).slice(1))
    }
    const preview = await previewSite({ root, host: '127.0.0.1', port: 0 })
    try {
      const origin = preview.resolvedUrls?.local[0]
      if (!origin) throw new Error('Preview server did not expose a local URL')
      const previewHtml = await (await fetch(origin)).text()
      const optimized = previewHtml.match(/<img[^>]+src="([^"]+)"/)
      expect(optimized?.[1]).toContain('/assets/nib/')
      expect((await fetch(new URL(optimized![1], origin))).status).toBe(200)
    } finally {
      await preview.close()
    }
  }, 30_000)
})
