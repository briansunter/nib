import { describe, expect, it } from 'vitest'
import { renderDocument, renderRedirectDocument } from '../src/framework/document'
import { renderHead } from '../src/framework/meta'
import type { RenderedPage } from '../src/framework/types'

const template = `<!doctype html><head><!--head-outlet--><script type="module">refresh()</script><script data-nib-islands type="module" src="/assets/islands.js"></script></head><body><!--ssr-outlet--></body>`

function page(islands: string[]): RenderedPage {
  return {
    status: 200,
    head: '<title>Page</title>',
    html: '<main>Page</main>',
    islands,
  }
}

describe('HTML documents', () => {
  it('renders escaped structured site, page, and plugin head contributions', () => {
    const html = renderHead(
      {
        title: 'Page',
        description: 'Description',
        head: {
          elements: [{
            tag: 'script',
            attributes: { type: 'application/ld+json' },
            content: '{"url":"</script>"}',
          }],
        },
      },
      {
        head: {
          elements: [{
            tag: 'link',
            attributes: { rel: 'alternate', href: '/rss.xml?x="unsafe"' },
          }],
        },
      },
      {
        elements: [{
          tag: 'meta',
          attributes: { property: 'og:title', content: 'A & B' },
        }],
      },
    )
    expect(html).toContain('<title>Page</title>')
    expect(html).toContain('href="/rss.xml?x=&quot;unsafe&quot;"')
    expect(html).toContain('content="A &amp; B"')
    expect(html).toContain('<\\/script>')
  })

  it('rejects unsafe structured head attributes', () => {
    expect(() => renderHead({
      title: 'Page',
      description: '',
      head: {
        elements: [{
          tag: 'meta',
          attributes: { onclick: 'alert(1)' },
        }],
      },
    })).toThrow('unsafe attribute name')
  })

  it('removes only the island entry from static pages', () => {
    const html = renderDocument(template, page([]))
    expect(html).toContain('<script type="module">refresh()</script>')
    expect(html).not.toContain('data-nib-islands')
    expect(html).toContain('<title>Page</title>')
    expect(html).toContain('<main>Page</main>')
  })

  it('keeps the island entry on interactive pages', () => {
    expect(renderDocument(template, page(['counter']))).toContain('data-nib-islands')
  })

  it('requires a marked client entry when a page uses islands', () => {
    expect(() => renderDocument(
      '<head><!--head-outlet--></head><body><!--ssr-outlet--></body>',
      page(['counter']),
    )).toThrow('missing the island entry')
  })

  it('requires exactly one head and SSR outlet', () => {
    expect(() => renderDocument('<body><!--ssr-outlet--></body>', page([])))
      .toThrow('exactly one <!--head-outlet--> outlet')
    expect(() => renderDocument('<head><!--head-outlet--></head>', page([])))
      .toThrow('exactly one <!--ssr-outlet--> outlet')
    expect(() => renderDocument(
      '<head><!--head-outlet--><!--head-outlet--></head><body><!--ssr-outlet--></body>',
      page([]),
    )).toThrow('exactly one <!--head-outlet--> outlet')
  })

  it('rejects duplicate island entry blocks', () => {
    const duplicate = `${template}<script data-nib-islands type="module"></script>`
    expect(() => renderDocument(duplicate, page([])))
      .toThrow('multiple island entry blocks')
  })

  it('escapes static redirect destinations', () => {
    const html = renderRedirectDocument('/next?value="unsafe"&other=<tag>')
    expect(html).toContain('url=/next?value=&quot;unsafe&quot;&amp;other=&lt;tag&gt;')
    expect(html).not.toContain('<tag>')
  })
})
