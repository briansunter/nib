import { describe, expect, it } from 'vitest'
import {
  canonicalRequestRedirect,
  createPublicationManifest,
  routeArtifactPath,
  routeArtifacts,
  previewCanonicalRedirect,
  previewExtensionlessPageArtifacts,
} from '../src/framework/publication'

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
          page: { status: 200, head: '', html: '', islands: [] },
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
    expect(Object.isFrozen(manifest.routes)).toBe(true)
  })
})
