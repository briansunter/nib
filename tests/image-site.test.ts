import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildSite, previewSite, startDevSite } from '../src/framework/site'

const root = path.resolve('tests/fixtures/image-site')

afterAll(async () => {
  await fs.rm(path.join(root, 'dist'), { recursive: true, force: true })
  await fs.rm(path.join(root, '.nib'), { recursive: true, force: true })
})

describe('optional image plugin', () => {
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
      expect((await optimized.arrayBuffer()).byteLength).toBeGreaterThan(0)
      expect((await fetch(new URL('/@nib-images/not-a-source/1-80.jpeg', origin))).status).toBe(404)
    } finally {
      await server.close()
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
    const assets = await fs.readdir(path.join(root, 'dist/client/assets/nib'))
    expect(assets.some((asset) => asset.endsWith('.webp'))).toBe(true)
    expect(assets.some((asset) => asset.endsWith('.jpeg'))).toBe(true)
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
