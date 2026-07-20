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
    const requestWithoutFollowingRedirects = (pathname: string) => fetch(new URL(pathname, origin), {
      headers: { connection: 'close' },
      redirect: 'manual',
    })
    const home = await request('/journal/')
    const about = await request('/journal/about/?source=test')
    const missing = await request('/journal/missing/')
    const canonicalRedirect = await request('/journal/about')
    const configuredRedirect = await request('/journal/legacy/')
    const sitemap = await request('/journal/sitemap.xml')
    const rss = await request('/journal/rss.xml')
    const settings = await request('/journal/settings/')

    expect(home.status).toBe(200)
    const homeHtml = await home.text()
    expect(homeHtml).toContain('Journal home')
    expect(homeHtml).toContain('<link rel="stylesheet" href="/journal/src/style.css" />')
    expect(homeHtml).toContain('src="/journal/@id/virtual:nib/client-entry"')
    expect(about.status).toBe(200)
    expect(await about.text()).toContain('About the journal')
    expect(missing.status).toBe(404)
    expect(await missing.text()).toContain('Journal not found')
    expect(canonicalRedirect.status).toBe(200)
    expect(canonicalRedirect.url.endsWith('/journal/about/')).toBe(true)
    expect(configuredRedirect.status).toBe(200)
    expect(configuredRedirect.url.endsWith('/journal/about/')).toBe(true)
    const canonicalResponse = await requestWithoutFollowingRedirects('/journal/about')
    const configuredResponse = await requestWithoutFollowingRedirects('/journal/legacy/')
    expect(canonicalResponse.status).toBe(301)
    expect(canonicalResponse.headers.get('location')).toBe('/journal/about/')
    expect(configuredResponse.status).toBe(301)
    expect(configuredResponse.headers.get('location')).toBe('/journal/about/')
    expect(sitemap.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    expect(await sitemap.text()).toContain('<urlset ')
    expect(rss.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
    expect(await rss.text()).toContain('<rss version="2.0"')
    expect(await settings.text()).toContain('TOML settings')
  }, 30_000)

  it('accepts an explicit remote Host allowlist without opening every host', async () => {
    const server = await startDevSite({
      root: path.resolve('tests/fixtures/basic-site'),
      host: '127.0.0.1',
      port: 0,
      allowedHosts: ['tail.example.test'],
    })
    servers.push(server)
    const origin = server.resolvedUrls?.local[0]
    if (!origin) throw new Error('Development server did not expose a local URL')

    const allowed = await fetch(new URL('/journal/', origin), {
      headers: { host: 'tail.example.test', connection: 'close' },
    })
    expect(allowed.status).toBe(200)
    expect(server.config.server.allowedHosts).toContain('tail.example.test')
  }, 30_000)
})
