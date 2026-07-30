import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { hostingArtifacts, normalizeHostingAdapter } from '../src/framework/hosting'
import { writeHostingArtifacts } from '../src/framework/hosting-writer'
import type { PublicationManifest } from '../src/framework/publication'
import { buildInfo } from '../src/integrations/build-info'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

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

  it('rejects unknown adapters instead of silently emitting an S3 manifest', () => {
    expect(() => hostingArtifacts(manifest, 'unknown' as never)).toThrow(
      'Unsupported Nib hosting adapter: unknown',
    )
  })
})

describe('normalizeHostingAdapter', () => {
  it('wraps a string adapter name in a config object', () => {
    expect(normalizeHostingAdapter('s3')).toEqual({ name: 's3' })
  })

  it('passes an adapter config object through unchanged', () => {
    const config = { name: 's3', htmlAliases: true } as const
    expect(normalizeHostingAdapter(config)).toBe(config)
  })
})

describe('hosting adapter forms', () => {
  it('accepts both the string and object form for the s3 adapter', () => {
    const withString = hostingArtifacts(manifest, 's3')
    const withObject = hostingArtifacts(manifest, { name: 's3' })
    expect(withString).toHaveLength(1)
    expect(withString[0]?.path).toBe('s3-website.json')
    expect(withObject).toEqual(withString)
  })
})

describe('writeHostingArtifacts s3 html aliases', () => {
  it('materializes a <path>.html companion for HTML routes and leaves resources alone', async () => {
    const clientDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-hosting-aliases-'))
    temporaryDirectories.push(clientDirectory)

    const homeBytes = '<title>Home</title>'
    const aboutBytes = '<title>About</title>'
    const feedBytes = '<feed />'
    // The home artifact is intentionally distinct from index.html so the
    // '/' -> 'index.html' alias copy is observable rather than a no-op.
    await fs.writeFile(path.join(clientDirectory, 'home.html'), homeBytes)
    await fs.mkdir(path.join(clientDirectory, 'about'), { recursive: true })
    await fs.writeFile(path.join(clientDirectory, 'about/index.html'), aboutBytes)
    await fs.writeFile(path.join(clientDirectory, 'feed.xml'), feedBytes)

    const htmlManifest: PublicationManifest = {
      version: 1,
      base: '/',
      trailingSlash: 'never',
      routes: [
        {
          kind: 'page',
          path: '/',
          artifact: 'home.html',
          status: 200,
          contentType: 'text/html; charset=utf-8',
        },
        {
          kind: 'page',
          path: '/about',
          artifact: 'about/index.html',
          status: 200,
          contentType: 'text/html; charset=utf-8',
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

    await writeHostingArtifacts(clientDirectory, htmlManifest, {
      adapters: [{ name: 's3', htmlAliases: true }],
    })

    // '/' maps to index.html, copying the distinct home artifact forward.
    const indexCompanion = await fs.readFile(path.join(clientDirectory, 'index.html'), 'utf8')
    expect(indexCompanion).toBe(homeBytes)

    // An HTML page route gets a <path>.html companion with identical bytes.
    const aboutCompanion = await fs.readFile(path.join(clientDirectory, 'about.html'), 'utf8')
    expect(aboutCompanion).toBe(aboutBytes)

    // A non-HTML resource route gets no companion.
    await expect(fs.access(path.join(clientDirectory, 'feed.xml.html'))).rejects.toThrow()
  })

  it('skips html companions when htmlAliases is not enabled', async () => {
    const clientDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-hosting-no-aliases-'))
    temporaryDirectories.push(clientDirectory)

    await fs.mkdir(path.join(clientDirectory, 'about'), { recursive: true })
    await fs.writeFile(path.join(clientDirectory, 'about/index.html'), '<title>About</title>')

    const htmlManifest: PublicationManifest = {
      version: 1,
      base: '/',
      trailingSlash: 'never',
      routes: [
        {
          kind: 'page',
          path: '/about',
          artifact: 'about/index.html',
          status: 200,
          contentType: 'text/html; charset=utf-8',
        },
      ],
    }

    await writeHostingArtifacts(clientDirectory, htmlManifest, { adapters: [{ name: 's3' }] })
    await expect(fs.access(path.join(clientDirectory, 'about.html'))).rejects.toThrow()
  })
})

describe('buildInfo plugin', () => {
  it('emits an app-owned JSON resource from static values', async () => {
    const plugin = buildInfo({
      path: '/build-info.json',
      values: { schemaVersion: 1, sourceSha: 'abc' },
    })
    const route = (await plugin.routes?.({} as never)) as {
      kind: string
      path: string
      contentType: string
      body: string
    }
    expect(route).toMatchObject({ kind: 'resource', path: '/build-info.json' })
    expect(route.contentType).toContain('application/json')
    expect(route.body).toContain('"sourceSha":"abc"')
    expect(JSON.parse(route.body)).toEqual({ schemaVersion: 1, sourceSha: 'abc' })
  })

  it('evaluates function values at build time', async () => {
    const plugin = buildInfo({
      path: '/build-info.json',
      values: () => ({ builtAt: '2026-01-01', schemaVersion: 2 }),
    })
    const route = (await plugin.routes?.({} as never)) as { kind: string; body: string }
    expect(route.body).toContain('"builtAt":"2026-01-01"')
    expect(JSON.parse(route.body)).toEqual({ builtAt: '2026-01-01', schemaVersion: 2 })
  })

  it('rejects non-json and non-absolute paths', () => {
    expect(() => buildInfo({ path: '/build-info.txt', values: {} })).toThrow('json route')
    expect(() => buildInfo({ path: 'build-info.json', values: {} })).toThrow('json route')
  })
})
