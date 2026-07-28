import { describe, expect, it } from 'vitest'
import { createProjectRenderer } from '../src/framework/project-renderer'
import { defineCollection, fromCollection } from '../src/framework/content'
import { markdownBody, type ContentRenderer } from '../src/framework/markdown-content'
import type { PageLayoutProps } from '../src/framework/types'
import { rss } from '../src/rss'

const Page = () => <h1>Home</h1>

describe('project renderer', () => {
  it('grants resource plugins mapped access to one immutable collection', async () => {
    const posts = defineCollection({
      loader: async () => [{ id: 'one', data: { title: 'One' } }],
      validate(value) {
        return value as { title: string }
      },
    })
    const renderer = await createProjectRenderer({
      config: {
        site: {
          title: 'Site',
          description: 'Description',
          origin: 'https://example.test',
        },
        collections: { posts },
        plugins: [rss({
          items: fromCollection(posts, (entries) => entries.map((entry) => ({
            title: entry.data.title,
            link: `/posts/${entry.id}`,
          }))),
        })],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })
    const output = renderer.render('/rss.xml')
    expect(output.kind).toBe('resource')
    if (output.kind !== 'resource') throw new Error('Expected resource')
    expect(output.body).toContain('<title>One</title>')
    expect(output.body).toContain('https://example.test/posts/one')
  })

  it('rejects collection capabilities that the site did not register', async () => {
    const privatePosts = defineCollection({
      loader: async () => [{ id: 'one', data: { title: 'One' } }],
      validate(value) {
        return value as { title: string }
      },
    })
    const capability = fromCollection(privatePosts, (entries) => entries)

    await expect(createProjectRenderer({
      config: {
        site: { title: 'Site' },
        plugins: [{
          name: 'unauthorized-reader',
          routes(context) {
            context.readCollection(capability)
            return []
          },
        }],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })).rejects.toThrow('not registered by this site')
  })

  it('owns route setup and document data rendering behind one interface', async () => {
    const renderer = await createProjectRenderer({
      config: { site: { title: 'Site', description: 'Description' } },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })

    expect(renderer.paths).toEqual(['/'])
    expect(renderer.render('/')).toMatchObject({
      kind: 'page',
      page: {
        status: 200,
        head: '<title>Site</title>\n    <meta name="description" content="Description" />',
        html: '<header><a href="/">Site</a></header><main><h1>Home</h1></main>',
        islands: [],
        behaviors: [],
      },
    })
  })

  it('lets a named layout own one Markdown semantic root through Content', async () => {
    const body = markdownBody('# Body', { file: '/src/pages/page.md' })
    function FolderLayout({ children }: PageLayoutProps) {
      return <main>{children}</main>
    }
    function ArticleLayout({ Content }: PageLayoutProps) {
      if (!Content) throw new Error('Expected bound Markdown Content')
      return <Content as="section" className="article-body" data-pagefind-body="" />
    }
    function GeneratedMarkdownPage({ Content }: { Content?: ContentRenderer }) {
      return Content ? <Content /> : <p>Fallback body</p>
    }
    const renderer = await createProjectRenderer({
      config: { site: { title: 'Site' } },
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/pages/page.md': {
          default: GeneratedMarkdownPage,
          layout: 'article',
          content: body,
        },
      },
      folderLayouts: {
        '/src/pages/layout.tsx': { default: FolderLayout },
      },
      namedLayouts: {
        '/src/layouts/article.tsx': { default: ArticleLayout },
      },
      islandModules: {},
    })
    const output = renderer.render('/')
    if (output.kind !== 'page') throw new Error('Expected page')
    expect(output.page.html).toContain(
      '<main><section class="article-body" data-pagefind-body=""><h1>Body</h1></section></main>',
    )
    expect(output.page.html).not.toContain('Fallback body')
  })

  it('enforces trailing slashes and configured redirects in development rendering', async () => {
    const renderer = await createProjectRenderer({
      config: {
        site: { title: 'Site' },
        trailingSlash: 'never',
        redirects: {
          '/old': { destination: '/about/', status: 302 },
        },
      },
      root: process.cwd(),
      base: '/base/',
      pages: { '/src/pages/about/page.tsx': { default: Page } },
      islandModules: {},
      command: 'serve',
    })

    expect(renderer.render('/base/about/')).toEqual({
      kind: 'redirect',
      status: 301,
      destination: '/base/about',
    })
    expect(renderer.render('/base/old')).toEqual({
      kind: 'redirect',
      status: 302,
      destination: '/base/about',
    })
  })
})
