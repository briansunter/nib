import { describe, expect, it } from 'vitest'
import { renderProjectProse } from './project-prose'

describe('renderProjectProse', () => {
  it('adds source-compatible heading IDs and image captions', () => {
    const html = renderProjectProse(
      '<h2>Search &amp; Query</h2><p><img src="/diagram.png" alt="Architecture diagram"></p>',
    )

    expect(html).toContain('<h2 id="search--query">Search &amp; Query</h2>')
    expect(html).toContain(
      '<figure><img src="/diagram.png" alt="Architecture diagram"><figcaption>Architecture diagram</figcaption></figure>',
    )
  })

  it('renders Shiki markup with the source code header and copy control', () => {
    const html = renderProjectProse(
      '<pre><code class="language-typescript">const answer = 42;\n</code></pre>',
    )

    expect(html).toContain('class="code-block-wrapper"')
    expect(html).toContain('<span class="code-block-lang">typescript</span>')
    expect(html).toContain('class="copy-button"')
    expect(html).toContain('data-copy-button')
    expect(html).toContain('data-code="const answer = 42;"')
    expect(html).toContain('class="copy-icon"')
    expect(html).toContain('<span class="copy-button-label">Copy</span>')
    expect(html).toContain('class="astro-code github-dark"')
    expect(html).toContain('data-language="typescript"')
  })

  it('matches source smart quotes without changing code', () => {
    const html = renderProjectProse(
      '<p>It&#39;s called &quot;Nib&quot;.</p><pre><code class="language-typescript">const label = \"straight\";</code></pre>',
    )

    expect(html).toContain('<p>It’s called “Nib”.</p>')
    expect(html).toContain(
      'data-code="const label = &#x22;straight&#x22;;"',
    )
    expect(html).toContain('> "straight"</span>')
  })
})
