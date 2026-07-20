import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildSite, previewSite } from '../src/framework/site'

const neverRoot = path.resolve('tests/fixtures/trailing-never-site')
const alwaysRoot = path.resolve('tests/fixtures/trailing-always-site')

function publicPath(origin: string, route: string): string {
  const url = new URL(route.replace(/^\/+/, ''), origin)
  return `${url.pathname}${url.search}${url.hash}`
}

afterAll(async () => {
  await Promise.all([neverRoot, alwaysRoot].map((root) => fs.rm(path.join(root, 'dist'), {
    recursive: true,
    force: true,
  })))
})

describe('trailingSlash: never publication', () => {
  it('publishes extensionless canonical files and redirects slash-form preview requests', async () => {
    await buildSite({ root: neverRoot })

    await expect(fs.readFile(path.join(neverRoot, 'dist/client/about'), 'utf8'))
      .resolves.toContain('No slash about')

    const preview = await previewSite({
      root: neverRoot,
      host: '127.0.0.1',
      port: 0,
      allowedHosts: ['tail.example.test'],
    })
    try {
      const origin = preview.resolvedUrls?.local[0]
      if (!origin) throw new Error('Preview server did not expose a local URL')
      const canonical = await fetch(new URL('about', origin), {
        headers: { accept: 'text/html' },
        redirect: 'manual',
      })
      const alternate = await fetch(new URL('about/?source=test', origin), { redirect: 'manual' })
      expect(canonical.status).toBe(200)
      expect(canonical.headers.get('content-type')).toContain('text/html')
      expect(await canonical.text()).toContain('No slash about')
      expect(alternate.status).toBe(301)
      expect(alternate.headers.get('location')).toBe(publicPath(origin, 'about?source=test'))
      const remoteHost = await fetch(new URL('about', origin), {
        headers: { host: 'tail.example.test', accept: 'text/html' },
      })
      expect(remoteHost.status).toBe(200)
    } finally {
      await preview.close()
    }
  }, 30_000)

  it('publishes directory indexes and redirects extensionless preview requests for always', async () => {
    await buildSite({ root: alwaysRoot })
    await expect(fs.readFile(path.join(alwaysRoot, 'dist/client/about/index.html'), 'utf8'))
      .resolves.toContain('Slash about')

    const preview = await previewSite({ root: alwaysRoot, host: '127.0.0.1', port: 0 })
    try {
      const origin = preview.resolvedUrls?.local[0]
      if (!origin) throw new Error('Preview server did not expose a local URL')
      const alternate = await fetch(new URL('about?source=test', origin), { redirect: 'manual' })
      const canonical = await fetch(new URL('about/', origin), { redirect: 'manual' })
      expect(alternate.status).toBe(301)
      expect(alternate.headers.get('location')).toBe(publicPath(origin, 'about/?source=test'))
      expect(canonical.status).toBe(200)
      expect(await canonical.text()).toContain('Slash about')
    } finally {
      await preview.close()
    }
  }, 30_000)
})
