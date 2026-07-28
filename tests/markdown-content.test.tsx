import { describe, expect, it } from 'vitest'
import {
  Content,
  markdownBody,
} from '../src/framework/markdown-content'
import { renderReactPage } from '../src/framework/render-page'

describe('Markdown content values', () => {
  it('uses the shared profile and lets the renderer own a semantic root', () => {
    const body = markdownBody('# Generated', {
      file: '/site/src/content/generated.md',
      profile: {
        rehypePlugins: [
          () => (tree: any) => {
            tree.children[0].properties = { id: 'generated' }
          },
        ],
      },
    })
    const rendered = renderReactPage(
      <Content
        body={body}
        as="section"
        className="prose"
        data-pagefind-body=""
      />,
      [body],
    )
    expect(rendered.html).toBe(
      '<section class="prose" data-pagefind-body=""><h1 id="generated">Generated</h1></section>',
    )
    expect(body.source).toBe('/site/src/content/generated.md')
    expect(Object.isFrozen(body)).toBe(true)
  })

  it('requires each route body exactly once per render pass', () => {
    const body = markdownBody('Body', { file: '/site/body.md' })
    expect(() => renderReactPage(<main>Missing</main>, [body]))
      .toThrow('was not rendered')
    expect(() => renderReactPage(
      <>
        <Content body={body} />
        <Content body={body} />
      </>,
      [body],
    )).toThrow('rendered more than once')
  })

  it('rejects forged content, event handlers, and source-located plugin errors', () => {
    expect(() => renderReactPage(
      <Content body={{ kind: 'nib-markdown-content', source: 'bad', html: '<b>bad</b>' } as never} />,
    )).toThrow('value from markdownBody')

    const body = markdownBody('Body', { file: '/site/body.md' })
    expect(() => renderReactPage(
      <Content body={body} onClick={() => undefined} />,
    )).toThrow('root props must be static')

    expect(() => markdownBody('Body', {
      file: '/site/broken.md',
      profile: {
        remarkPlugins: [
          () => () => {
            throw new Error('profile failed')
          },
        ],
      },
    })).toThrow('Markdown body /site/broken.md: profile failed')
  })
})
