import { describe, expect, it } from 'vitest'
import { markdownToCompiledPage } from '../../../../src/framework/markdown'
import { rehypePlugins, remarkPlugins } from './markdown-plugins'

function render(source: string): string {
  return markdownToCompiledPage(source, {
    allowDangerousHtml: true,
    remarkPlugins,
    rehypePlugins,
  }).html
}

describe('source Markdown rendering parity', () => {
  it('applies Astro smart typography without rewriting inline or fenced code', () => {
    const html = render([
      '"Large Language Models" and There\'s...',
      '',
      '`"inline code"...`',
      '',
      '```text',
      '"fenced code"...',
      '```',
    ].join('\n'))

    expect(html).toContain('<p>“Large Language Models” and There’s…</p>')
    expect(html).toContain('<code>"inline code"...</code>')
    expect(html).toContain('<span>"fenced code"...</span>')
  })

  it('resolves nested newsletter basenames while preserving literal wikilinks in code', () => {
    const html = render([
      'Read [[issue-10|the full blog post]].',
      '',
      'Use `[[issue-10|literal]]` in a code span.',
      '',
      '```text',
      '[[issue-10|literal]]',
      '```',
    ].join('\n'))

    expect(html).toContain(
      '<a class="internal" href="/newsletter/issue-10">the full blog post</a>',
    )
    expect(html).toContain('<code>[[issue-10|literal]]</code>')
    expect(html).toContain('[[issue-10|literal]]')
  })

  it('uses pipe aliases as labels and demotes unresolved aliases to plain text', () => {
    const html = render([
      'Read [[issue-10|Newsletter issue ten]].',
      '',
      'Read [[definitely-missing|Visible fallback]].',
    ].join('\n'))

    expect(html).toContain(
      '<a class="internal" href="/newsletter/issue-10">Newsletter issue ten</a>',
    )
    expect(html).toContain('<p>Read Visible fallback.</p>')
    expect(html).not.toContain('href="/definitely-missing"')
  })

  it('derives source-equivalent image alt text without changing filename hyphens', () => {
    const html = render([
      '![ ](/site-assets/Screenshot_2022-12-26_at_8.52.16_PM_1672123954817_0.png)',
      '',
      '![ ](/site-assets/released-2024-03-15.png)',
    ].join('\n'))

    expect(html).toContain('alt="Screenshot 2022-12-26 at 8.52.16 PM"')
    expect(html).toContain('alt="released-2024-03-15"')
    expect(html).not.toContain('released 2024 03 15')
  })

  it('leaves math nodes for KaTeX instead of wrapping them as Shiki code', () => {
    const html = render([
      'Inline $n^2$.',
      '',
      '$$',
      'T(n)=n^2',
      '$$',
    ].join('\n'))

    expect(html).toContain('<span class="katex">')
    expect(html).toContain('<span class="katex-display">')
    expect(html).not.toContain('data-language="math"')
    expect(html).not.toContain('class="code-block-wrapper"')
  })

  it('parses cached tweet cards after figure processing', () => {
    const html = render('{{ tweet 1539005769017958404 }}')

    expect(html).toContain('class="tweet-avatar')
    expect(html).toContain('class="tweet-media')
    expect(html).not.toContain('<figure')
    expect(html).not.toContain('<figcaption')
  })

  it('removes a standalone unavailable tweet like the source plugin', () => {
    const html = render('{{ tweet 1539677453076922368 }}')

    expect(html).not.toContain('{{ tweet 1539677453076922368 }}')
    expect(html).not.toContain('class="tweet-card"')
  })

  it('preserves an unavailable tweet directive embedded in prose', () => {
    const html = render([
      'This is part of the same paragraph.',
      '{{ tweet 1539677453076922368 }}',
    ].join('\n'))

    expect(html).toContain('{{ tweet 1539677453076922368 }}')
    expect(html).not.toContain('class="tweet-card"')
  })

  it('resolves redirect-source wiki links such as the newsletter alias', () => {
    const html = render('Read [[newsletter]].')

    expect(html).toContain('<a class="internal" href="/newsletter">newsletter</a>')
  })

  it('renders the source YouTube shortcode presentation and permissions', () => {
    const html = render('{{< youtube dQw4w9WgXcQ >}}')

    expect(html).toContain('width="100%"')
    expect(html).toContain('height="315"')
    expect(html).toContain('title="YouTube video"')
    expect(html).toContain('frameborder="0"')
    expect(html).toContain(
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"',
    )
    expect(html).toContain('allowfullscreen')
    expect(html).toContain('style="max-width: 600px; border-radius: 8px;"')
  })
})
