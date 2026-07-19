import { describe, expect, it } from 'vitest'
import {
  canonicalRequestRedirect,
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
})
