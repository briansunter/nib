import { describe, expect, it } from 'vitest'
import { hostingArtifacts } from '../src/framework/hosting'
import type { PublicationManifest } from '../src/framework/publication'

const manifest: PublicationManifest = {
  version: 1,
  base: '/docs/',
  trailingSlash: 'always',
  routes: [
    {
      kind: 'redirect',
      path: '/legacy/',
      artifact: 'legacy/index.html',
      status: 302,
      contentType: 'text/html; charset=utf-8',
      destination: '/docs/about/?from=legacy#top',
    },
    {
      kind: 'page',
      path: '/about/',
      artifact: 'about/index.html',
      status: 200,
      contentType: 'text/html; charset=utf-8',
    },
    {
      kind: 'redirect',
      path: '/external/',
      artifact: 'external/index.html',
      status: 302,
      contentType: 'text/html; charset=utf-8',
      destination: 'https://example.test/new',
    },
    {
      kind: 'resource',
      path: '/feed.xml',
      artifact: 'feed.xml',
      status: 200,
      contentType: 'application/xml',
    },
  ],
}

const redirects = [
  {
    source: '/docs/legacy/',
    destination: '/docs/about/?from=legacy#top',
    status: 302,
  },
  {
    source: '/docs/external/',
    destination: 'https://example.test/new',
    status: 302,
  },
  { source: '/docs/legacy', destination: '/docs/legacy/', status: 301 },
  { source: '/docs/about', destination: '/docs/about/', status: 301 },
  { source: '/docs/external', destination: '/docs/external/', status: 301 },
]

describe('hosting redirects', () => {
  it('preserves explicit redirects before generated trailing-slash aliases', () => {
    expect(hostingArtifacts(manifest, 'netlify')).toEqual([{
      path: '_redirects',
      body: `${redirects.slice(0, 2)
        .map(({ source, destination, status }) => `${source} ${destination} ${status}!`)
        .join('\n')}\n`,
    }])

    const cloudflare = hostingArtifacts(manifest, 'cloudflare')
    expect(cloudflare[0]).toEqual({
      path: '_redirects',
      body: `${redirects
        .map(({ source, destination, status }) => `${source} ${destination} ${status}`)
        .join('\n')}\n`,
    })
    expect(cloudflare[1]?.path).toBe('_headers')
  })

  it('uses exact status codes in structured hosting companions', () => {
    const vercel = JSON.parse(hostingArtifacts(manifest, 'vercel')[0]!.body)
    expect(vercel.redirects).toEqual(redirects.map((rule) => ({
      source: rule.source,
      destination: rule.destination,
      statusCode: rule.status,
    })))

    const s3 = JSON.parse(hostingArtifacts(manifest, 's3')[0]!.body)
    expect(s3.redirects).toEqual(redirects)
    expect(s3.routes).toHaveLength(manifest.routes.length)
  })

  it('keeps explicit redirects when slash aliases are disabled', () => {
    const ignored = { ...manifest, trailingSlash: 'ignore' as const }
    const rules = hostingArtifacts(ignored, 'netlify')[0]!.body.trim().split('\n')
    expect(rules).toEqual([
      '/docs/legacy/ /docs/about/?from=legacy#top 302!',
      '/docs/external/ https://example.test/new 302!',
    ])
  })

  it('rejects a malformed publication redirect without a destination', () => {
    const malformed: PublicationManifest = {
      ...manifest,
      routes: [{
        kind: 'redirect',
        path: '/broken/',
        artifact: 'broken/index.html',
        status: 301,
        contentType: 'text/html; charset=utf-8',
      }],
    }
    expect(() => hostingArtifacts(malformed, 'vercel')).toThrow(
      'Publication redirect /broken/ is missing its destination',
    )
  })

  it('fails clearly for redirect statuses Netlify cannot represent', () => {
    const unsupported: PublicationManifest = {
      ...manifest,
      routes: [{
        kind: 'redirect',
        path: '/temporary/',
        artifact: 'temporary/index.html',
        status: 307,
        contentType: 'text/html; charset=utf-8',
        destination: '/docs/about/',
      }],
    }
    expect(() => hostingArtifacts(unsupported, 'netlify')).toThrow(
      'Netlify does not support redirect status 307',
    )
    expect(hostingArtifacts(unsupported, 'cloudflare')[0]?.body)
      .toContain('/docs/temporary/ /docs/about/ 307')
  })
})
