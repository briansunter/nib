import path from 'node:path'
import type { ViteDevServer } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { startDevSite } from '../src/framework/site'

const servers: ViteDevServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
})

describe('framework-owned development server', () => {
  it('serves consumer routes below the configured base path', async () => {
    const server = await startDevSite({
      root: path.resolve('tests/fixtures/basic-site'),
      host: '127.0.0.1',
      port: 0,
    })
    servers.push(server)
    const origin = server.resolvedUrls?.local[0]
    if (!origin) throw new Error('Development server did not expose a local URL')

    const request = (pathname: string) => fetch(new URL(pathname, origin), {
      headers: { connection: 'close' },
    })
    const home = await request('/journal/')
    const about = await request('/journal/about/?source=test')
    const missing = await request('/journal/missing/')

    expect(home.status).toBe(200)
    const homeHtml = await home.text()
    expect(homeHtml).toContain('Journal home')
    expect(homeHtml).toContain('<link rel="stylesheet" href="/journal/src/style.css" />')
    expect(homeHtml).toContain('src="/journal/@id/virtual:nib/client-entry"')
    expect(about.status).toBe(200)
    expect(await about.text()).toContain('About the journal')
    expect(missing.status).toBe(404)
    expect(await missing.text()).toContain('Journal not found')
  }, 30_000)
})
