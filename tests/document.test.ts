import { describe, expect, it } from 'vitest'
import { renderDocument } from '../src/framework/document'
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
})
