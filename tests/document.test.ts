import { describe, expect, it } from 'vitest'
import { htmlTemplate } from '../src/framework/build/html-template'
import { renderDocument, renderRedirectDocument } from '../src/framework/document'
import { renderHead } from '../src/framework/meta'
import type { RenderedPage } from '../src/framework/types'

const template = `<!doctype html><head><!--head-outlet-->
<link rel="modulepreload" href="/assets/refresh.js" />
<script type="module">refresh()</script>
<link data-nib-runtime-preload="islands" rel="modulepreload" href="/assets/islands-runtime.js" />
<!--nib-islands-entry--><script data-nib-islands type="module" src="/assets/islands.js"></script>
<link data-nib-runtime-preload="enhancements" rel="modulepreload" href="/assets/enhancements-runtime.js" />
<!--nib-enhancements-entry--><script data-nib-enhancements type="module" src="/assets/enhancements.js"></script>
<link data-nib-runtime-preload="client" rel="modulepreload" href="/assets/client.js" />
<script data-nib-client type="module" src="/assets/client.js"></script>
</head><body><!--ssr-outlet--></body>`

function page(enhancements: string[] = [], islands: string[] = []): RenderedPage {
  return {
    status: 200,
    head: '<title>Page</title>',
    html: '<main>Page</main>',
    enhancements: enhancements.map((id) => ({ id, when: 'load' })),
    islands: islands.map((id) => ({ id, when: 'load' })),
  }
}

describe('HTML documents', () => {
  it('renders escaped structured page and plugin head contributions', () => {
    const html = renderHead(
      {
        title: 'Page',
        description: 'Description',
        head: {
          title: 'Page head title',
          description: 'Page head description',
          elements: [{
            tag: 'script',
            attributes: { type: 'application/ld+json' },
            content: '{"url":"</script>"}',
          }],
        },
      },
      {
        title: 'Renderer title',
        description: 'Renderer description',
        elements: [
          {
            tag: 'link',
            attributes: { rel: 'alternate', href: '/rss.xml?x="unsafe"' },
          },
          {
            tag: 'meta',
            attributes: { property: 'og:title', content: 'A & B' },
          },
        ],
      },
    )
    expect(html).toContain('<title>Renderer title</title>')
    expect(html).toContain('name="description" content="Renderer description"')
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
    expect(() => renderHead({
      title: 'Page',
      description: '',
      head: { title: 42 } as never,
    })).toThrow('head.title must be a string')
  })

  it('removes inactive route runtimes without touching app client assets', () => {
    const html = renderDocument(template, page())
    expect(html).toContain('<script type="module">refresh()</script>')
    expect(html).not.toContain('data-nib-runtime-preload="enhancements"')
    expect(html).not.toContain('data-nib-enhancements')
    expect(html).not.toContain('data-nib-runtime-preload="islands"')
    expect(html).not.toContain('data-nib-islands')
    expect(html).toContain('href="/assets/refresh.js"')
    expect(html).toContain('data-nib-runtime-preload="client"')
    expect(html).toContain('data-nib-client')
    expect(html).toContain('<title>Page</title>')
    expect(html).toContain('<main>Page</main>')
  })

  it('keeps the enhancement entry and preload on enhanced pages', () => {
    const html = renderDocument(template, page(['pin']))
    expect(html).toContain('data-nib-enhancements')
    expect(html).toContain('data-nib-runtime-preload="enhancements"')
    expect(html).toContain('data-nib-client')
  })

  it('keeps shared client preloads when a static route drops enhancements', () => {
    const builtTemplate = htmlTemplate({
      enhancement: {
        source: '/assets/enhancements.js',
        preloads: ['/assets/shared.js', '/assets/enhancement-only.js'],
      },
      client: {
        source: '/assets/client.js',
        preloads: ['/assets/shared.js', '/assets/client-only.js'],
      },
      stylesheets: [],
    })

    const enhanced = renderDocument(builtTemplate, page(['search']))
    expect(enhanced.match(/href="\/assets\/shared\.js"/g)).toHaveLength(1)
    expect(enhanced).toContain(
      'data-nib-runtime-preload="client" rel="modulepreload" href="/assets/shared.js"',
    )

    const staticPage = renderDocument(builtTemplate, page())
    expect(staticPage).toContain('href="/assets/shared.js"')
    expect(staticPage).toContain('href="/assets/client-only.js"')
    expect(staticPage).not.toContain('href="/assets/enhancement-only.js"')
  })

  it('dedupes shared active runtime preloads after stripping inactive owners', () => {
    const builtTemplate = htmlTemplate({
      island: {
        source: '/assets/islands.js',
        preloads: ['/assets/shared-runtime.js', '/assets/island-only.js'],
      },
      enhancement: {
        source: '/assets/enhancements.js',
        preloads: ['/assets/shared-runtime.js', '/assets/enhancement-only.js'],
      },
      stylesheets: [],
    })

    const both = renderDocument(builtTemplate, page(['search'], ['counter']))
    expect(both.match(/href="\/assets\/shared-runtime\.js"/g)).toHaveLength(1)
    expect(both).toContain('href="/assets/island-only.js"')
    expect(both).toContain('href="/assets/enhancement-only.js"')

    const islandOnly = renderDocument(builtTemplate, page([], ['counter']))
    expect(islandOnly.match(/href="\/assets\/shared-runtime\.js"/g)).toHaveLength(1)
    expect(islandOnly).toContain('href="/assets/island-only.js"')
    expect(islandOnly).not.toContain('href="/assets/enhancement-only.js"')

    const enhancementOnly = renderDocument(builtTemplate, page(['search']))
    expect(enhancementOnly.match(/href="\/assets\/shared-runtime\.js"/g)).toHaveLength(1)
    expect(enhancementOnly).not.toContain('href="/assets/island-only.js"')
    expect(enhancementOnly).toContain('href="/assets/enhancement-only.js"')
  })

  it('requires a marked enhancement entry when a page uses enhancements', () => {
    expect(() => renderDocument(
      '<head><!--head-outlet--></head><body><!--ssr-outlet--></body>',
      page(['search']),
    )).toThrow('missing the enhancement entry')
  })

  it('requires exactly one head and SSR outlet', () => {
    expect(() => renderDocument('<body><!--ssr-outlet--></body>', page()))
      .toThrow('exactly one <!--head-outlet--> outlet')
    expect(() => renderDocument('<head><!--head-outlet--></head>', page()))
      .toThrow('exactly one <!--ssr-outlet--> outlet')
    expect(() => renderDocument(
      '<head><!--head-outlet--><!--head-outlet--></head><body><!--ssr-outlet--></body>',
      page(),
    )).toThrow('exactly one <!--head-outlet--> outlet')
  })

  it('rejects duplicate enhancement entry blocks', () => {
    const duplicate = `${template}<script data-nib-enhancements type="module"></script>`
    expect(() => renderDocument(duplicate, page()))
      .toThrow('multiple enhancement entry blocks')
  })

  it('escapes static redirect destinations', () => {
    const html = renderRedirectDocument('/next?value="unsafe"&other=<tag>')
    expect(html).toContain('url=/next?value=&quot;unsafe&quot;&amp;other=&lt;tag&gt;')
    expect(html).not.toContain('<tag>')
  })
})
