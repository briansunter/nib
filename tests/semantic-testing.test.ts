import { describe, expect, it } from 'vitest'
import {
  compareSemanticHtml,
  semanticHtmlSnapshot,
} from '../src/framework/testing'

describe('semantic publication testing', () => {
  it('compares parsed entities while excluding hidden and search-ignored content', () => {
    const source = `
      <main id="main-content">
        <h1 id="hello">“Hello” &amp; friends</h1>
        <p>Visible <span hidden>private</span> words.</p>
        <p data-pagefind-ignore>Search chrome</p>
        <a href="https://example.com/about/">About&nbsp;us</a>
      </main>
    `
    const target = `
      <main id="main-content">
        <h1 id="hello">"Hello" & friends</h1>
        <p>Visible words.</p>
        <a href="/about">About us</a>
        <div aria-hidden="true">different private text</div>
      </main>
    `
    const comparison = compareSemanticHtml(source, target, {
      pagefindAware: true,
      siteOrigin: 'https://example.com',
    })

    expect(comparison.equal).toBe(true)
    expect(comparison.normalizer).toBe('nib-semantic-v1')
    expect(Object.isFrozen(comparison.source)).toBe(true)
  })

  it('preserves repeated metadata, structures, and typography when requested', () => {
    const snapshot = semanticHtmlSnapshot(`
      <main>
        <h2>“One”</h2><h2>“One”</h2>
        <time datetime="2026-01-01">Jan 1</time>
        <time datetime="2026-01-02">Jan 2</time>
        <figure><figcaption>Caption</figcaption></figure>
      </main>
    `, {
      normalizer: 'nib-typography-v1',
      structuralTags: ['figure', 'figcaption'],
    })

    expect(snapshot.headings).toEqual([
      { level: 2, id: '', text: '“One”' },
      { level: 2, id: '', text: '“One”' },
    ])
    expect(snapshot.dates).toHaveLength(2)
    expect(snapshot.structures).toEqual({ figure: 1, figcaption: 1 })
  })

  it('uses an explicit root contract and reports field-level differences', () => {
    const comparison = compareSemanticHtml(
      '<main><p>One</p><pre>code</pre></main>',
      '<main><p>Two</p></main>',
    )

    expect(comparison.equal).toBe(false)
    expect(comparison.differences.map((difference) => difference.field)).toEqual([
      'text',
      'structures',
    ])
  })
})
