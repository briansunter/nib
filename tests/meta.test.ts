import { describe, expect, it } from 'vitest'
import { renderHead, resolveMeta } from '../src/framework/meta'

describe('metadata', () => {
  it('requires page-authored titles', () => {
    expect(resolveMeta({ title: 'About' })).toEqual({ title: 'About' })
    expect(() => resolveMeta(undefined)).toThrow('non-empty title')
    expect(() => resolveMeta({ title: '  ' })).toThrow('non-empty title')
    expect(() => resolveMeta({
      title: 'About',
      head: { title: '  ' },
    })).toThrow('head.title must be a non-empty string')
    expect(() => renderHead(
      resolveMeta({ title: 'About' }),
      { title: '' },
    )).toThrow('Renderer head contribution.title must be a non-empty string')
  })
  it('renders escaped title and description tags', () => {
    const head = renderHead(resolveMeta({ title: '<a "x">&\'', description: 'One & two' }))
    expect(head).toContain('<title>&lt;a &quot;x&quot;&gt;&amp;&#039;</title>')
    expect(head).toContain('One &amp; two')
  })
  it('omits an absent description instead of emitting an empty meta tag', () => {
    expect(renderHead(resolveMeta({ title: 'Page' }))).toBe('<title>Page</title>')
  })
})
