import { describe, expect, it } from 'vitest'
import { renderHead, resolveMeta } from '../src/framework/meta'

const site = { title: 'Site', description: 'Default', titleTemplate: '%s | Site' }

describe('metadata', () => {
  it('uses defaults and title templates', () => {
    expect(resolveMeta(undefined, site)).toMatchObject({ title: 'Site', description: 'Default' })
    expect(resolveMeta({ title: 'About' }, site).title).toBe('About | Site')
  })
  it('renders escaped title and description tags', () => {
    const head = renderHead(resolveMeta({ title: '<a "x">&\'', description: 'One & two' }, site))
    expect(head).toContain('<title>&lt;a &quot;x&quot;&gt;&amp;&#039; | Site</title>')
    expect(head).toContain('One &amp; two')
  })
})
