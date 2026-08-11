import { describe, expect, it } from 'vitest'
import { htmlTemplate } from '../src/framework/build/html-template'
import { renderDocument, renderRedirectDocument } from '../src/framework/document'
import { renderHead } from '../src/framework/meta'
import type { RenderedPage } from '../src/framework/types'

const template = `<!doctype html><head><!--head-outlet-->
<link rel="modulepreload" href="/assets/refresh.js" />
<script type="module">refresh()</script>
<link data-nib-runtime-preload="behaviors" rel="modulepreload" href="/assets/behaviors-runtime.js" />
<!--nib-behaviors-entry--><script data-nib-behaviors type="module" src="/assets/behaviors.js"></script>
<link data-nib-runtime-preload="client-bootstrap" rel="modulepreload" href="/assets/navigation.js" />
<script data-nib-client-bootstrap type="module" src="/assets/navigation.js"></script>
</head><body><!--ssr-outlet--></body>`

function page(behaviors: string[] = []): RenderedPage {
  return {
    status: 200,
    head: '<title>Page</title>',
    html: '<main>Page</main>',
    behaviors,
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

  it('removes an inactive behavior runtime without touching unrelated client assets', () => {
    const html = renderDocument(template, page())
    expect(html).toContain('<script type="module">refresh()</script>')
    expect(html).not.toContain('data-nib-runtime-preload="behaviors"')
    expect(html).not.toContain('data-nib-behaviors')
    expect(html).toContain('href="/assets/refresh.js"')
    expect(html).toContain('data-nib-runtime-preload="client-bootstrap"')
    expect(html).toContain('data-nib-client-bootstrap')
    expect(html).toContain('<title>Page</title>')
    expect(html).toContain('<main>Page</main>')
  })

  it('keeps the behavior entry and preload on enhanced pages', () => {
    const html = renderDocument(template, page(['pin']))
    expect(html).toContain('data-nib-behaviors')
    expect(html).toContain('data-nib-runtime-preload="behaviors"')
    expect(html).toContain('data-nib-client-bootstrap')
  })

  it('keeps shared bootstrap preloads when a static route drops behaviors', () => {
    const builtTemplate = htmlTemplate({
      behavior: {
        source: '/assets/behaviors.js',
        preloads: ['/assets/shared.js', '/assets/behavior-only.js'],
      },
      clientBootstrap: {
        source: '/assets/navigation.js',
        preloads: ['/assets/shared.js', '/assets/navigation-only.js'],
      },
      stylesheets: [],
    })

    const enhanced = renderDocument(builtTemplate, page(['search']))
    expect(enhanced.match(/href="\/assets\/shared\.js"/g)).toHaveLength(1)
    expect(enhanced).toContain(
      'data-nib-runtime-preload="client-bootstrap" rel="modulepreload" href="/assets/shared.js"',
    )

    const staticPage = renderDocument(builtTemplate, page())
    expect(staticPage).toContain('href="/assets/shared.js"')
    expect(staticPage).toContain('href="/assets/navigation-only.js"')
    expect(staticPage).not.toContain('href="/assets/behavior-only.js"')
  })

  it('requires a marked behavior entry when a page uses behaviors', () => {
    expect(() => renderDocument(
      '<head><!--head-outlet--></head><body><!--ssr-outlet--></body>',
      page(['search']),
    )).toThrow('missing the behavior entry')
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

  it('rejects duplicate behavior entry blocks', () => {
    const duplicate = `${template}<script data-nib-behaviors type="module"></script>`
    expect(() => renderDocument(duplicate, page()))
      .toThrow('multiple behavior entry blocks')
  })

  it('escapes static redirect destinations', () => {
    const html = renderRedirectDocument('/next?value="unsafe"&other=<tag>')
    expect(html).toContain('url=/next?value=&quot;unsafe&quot;&amp;other=&lt;tag&gt;')
    expect(html).not.toContain('<tag>')
  })
})
