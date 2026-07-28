import { markdownBody } from '@briansunter/nib'
import { describe, expect, it } from 'vitest'
import { projectMarkdown } from './project-markdown'

function render(source: string): string {
  return markdownBody(source, {
    file: 'src/content/projects/test.md',
    profile: projectMarkdown,
  }).html
}

describe('project Markdown profile', () => {
  it('adds source-compatible heading IDs and image captions', () => {
    const html = render('## Search & Query\n\n![Architecture diagram](/diagram.png)')
    expect(html).toContain('<h2 id="search--query">Search &#x26; Query</h2>')
    expect(html).toContain(
      '<figure><img src="/diagram.png" alt="Architecture diagram"><figcaption>Architecture diagram</figcaption></figure>',
    )
  })

  it('renders Shiki markup with the source code header and copy control', () => {
    const html = render('```typescript\nconst answer = 42;\n```')
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
    const html = render(`It's called "Nib".\n\n\`\`\`typescript\nconst label = "straight";\n\`\`\``)
    expect(html).toContain('<p>It’s called “Nib”.</p>')
    expect(html).toContain('data-code="const label = &#x22;straight&#x22;;"')
    expect(html).toContain('> "straight"</span>')
  })
})
