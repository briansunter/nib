import { describe, expect, it } from 'vitest'
import {
  canonicalRequestRedirect,
  createPublicationArtifactPlan,
  createPublicationManifest,
  createPublicationPlan,
  routeArtifactPath,
  routeArtifacts,
  previewCanonicalRedirect,
  previewExtensionlessPageArtifacts,
} from '../src/framework/publication'

const page = {
  kind: 'page' as const,
  page: { status: 200, head: '', html: '', behaviors: [] },
}

describe('route publication', () => {
  it('keeps canonical paths, static artifacts, and preview redirects aligned', () => {
    expect(routeArtifactPath('/projects', 'always')).toBe('projects/index.html')
    expect(routeArtifactPath('/projects', 'never')).toBe('projects')
    expect(routeArtifactPath('/rss.xml')).toBe('rss.xml')
    expect(routeArtifacts('/projects', 'never')).toEqual({ primary: 'projects' })
    expect(routeArtifacts('/projects', 'never', true)).toEqual({ primary: 'projects/index.html' })
    expect(canonicalRequestRedirect('/notes/', '/', '/notes', 'never')).toBe('/notes')
    expect(previewCanonicalRedirect('/notes/?draft=1', '/', 'never')).toBe('/notes?draft=1')
    expect(previewCanonicalRedirect('/notes?draft=1', '/', 'always')).toBe('/notes/?draft=1')
    expect(previewCanonicalRedirect('/rss.xml', '/', 'never')).toBeUndefined()
    expect(previewCanonicalRedirect('/notes/', '/', 'always')).toBeUndefined()
    expect(previewExtensionlessPageArtifacts('/notes', '/', 'never')).toEqual(['notes', 'notes/index.html'])
    expect(previewExtensionlessPageArtifacts('/rss.xml', '/', 'never')).toBeUndefined()
  })

  it('emits a deterministic route-to-artifact publication manifest', () => {
    const manifest = createPublicationManifest('/', 'never', [
      {
        routePath: '/rss.xml',
        artifact: 'rss.xml',
        output: {
          kind: 'resource',
          status: 200,
          body: '<rss />',
          contentType: 'application/rss+xml',
        },
      },
      {
        routePath: '/about',
        artifact: 'about',
        output: {
          kind: 'page',
          page: { status: 200, head: '', html: '', behaviors: [] },
        },
      },
      {
        routePath: '/old',
        artifact: 'old',
        output: {
          kind: 'redirect',
          status: 301,
          destination: '/about',
        },
      },
    ])
    expect(manifest).toEqual({
      version: 1,
      base: '/',
      trailingSlash: 'never',
      routes: [
        {
          kind: 'page',
          path: '/about',
          artifact: 'about',
          status: 200,
          contentType: 'text/html; charset=utf-8',
        },
        {
          kind: 'redirect',
          path: '/old',
          artifact: 'old',
          status: 301,
          contentType: 'text/html; charset=utf-8',
          destination: '/about',
        },
        {
          kind: 'resource',
          path: '/rss.xml',
          artifact: 'rss.xml',
          status: 200,
          contentType: 'application/rss+xml',
        },
      ],
    })
    expect(Object.isFrozen(manifest)).toBe(true)
    expect(Object.isFrozen(manifest.routes)).toBe(true)
    expect(manifest.routes.every((route) => Object.isFrozen(route))).toBe(true)
  })

  it('indexes descendants before planning extensionless parent artifacts', () => {
    expect(createPublicationArtifactPlan([
      '/guides/getting-started',
      '/guides',
      '/independent',
    ], 'never')).toEqual([
      { routePath: '/guides/getting-started', artifact: 'guides/getting-started' },
      { routePath: '/guides', artifact: 'guides/index.html' },
      { routePath: '/independent', artifact: 'independent' },
    ])
    expect(createPublicationPlan([
      { routePath: '/guides/getting-started', output: page },
      { routePath: '/guides', output: page },
      { routePath: '/independent', output: page },
    ], 'never').map(({ routePath, artifact }) => ({ routePath, artifact }))).toEqual([
      { routePath: '/guides/getting-started', artifact: 'guides/getting-started' },
      { routePath: '/guides', artifact: 'guides/index.html' },
      { routePath: '/independent', artifact: 'independent' },
    ])
  })

  it('rejects duplicate artifact destinations before publication', () => {
    expect(() => createPublicationPlan([
      { routePath: '/', output: page },
      { routePath: '/index.html', output: page },
    ])).toThrowError(
      'Nib cannot publish routes "/" and "/index.html" to the same artifact "index.html"',
    )

    expect(() => createPublicationPlan([
      { routePath: '/404', output: page },
      { routePath: '/404.html', output: page },
    ])).toThrowError(
      'Nib cannot publish routes "/404" and "/404.html" to the same artifact "404.html"',
    )
  })

  it('rejects artifacts that need another route artifact as a directory', () => {
    expect(() => createPublicationPlan([
      { routePath: '/archive.json', output: page },
      { routePath: '/archive.json/entry', output: page },
    ], 'never')).toThrowError(
      'route "/archive.json" publishes the required directory "archive.json" as a file',
    )
  })
})
