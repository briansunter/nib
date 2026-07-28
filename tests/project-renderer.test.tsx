import { describe, expect, it } from 'vitest'
import { createProjectRenderer } from '../src/framework/project-renderer'
import { defineCollection, fromCollection } from '../src/framework/content'
import { markdownBody, type ContentRenderer } from '../src/framework/markdown-content'
import type {
  PageLayoutProps,
  PageProps,
  PageRoute,
  ResolvedSite,
  SiteShellProps,
} from '../src/framework/types'
import { definePlugin } from '../src/framework/plugin'
import { createPublicationManifest } from '../src/framework/publication'
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

  it('publishes non-404 routes even when their response status is 404', async () => {
    const renderer = await createProjectRenderer({
      config: {
        site: { title: 'Site' },
        trailingSlash: 'always',
        plugins: [{
          name: 'not-found-resources',
          routes: () => [
            {
              kind: 'resource',
              path: '/missing.json',
              status: 404,
              contentType: 'application/json',
              body: '{}',
            },
            {
              kind: 'resource',
              path: '/gone',
              status: 404,
              contentType: 'text/plain',
              body: 'gone',
            },
          ],
        }],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })

    expect(renderer.paths).toEqual(['/', '/missing.json', '/gone/'])
    expect(renderer.render('/missing.json')).toMatchObject({
      kind: 'resource',
      status: 404,
      body: '{}',
    })
    expect(renderer.render('/gone')).toEqual({
      kind: 'redirect',
      status: 301,
      destination: '/gone/',
    })
    expect(renderer.render('/gone/')).toMatchObject({
      kind: 'resource',
      status: 404,
      body: 'gone',
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

  it('shares deeply immutable public route and site snapshots across every render seam', async () => {
    const site = {
      title: 'Site',
      navigation: [{ label: 'Home', href: '/' }],
      head: {
        elements: [{
          tag: 'meta' as const,
          attributes: { name: 'site-owner', content: 'site' },
        }],
      },
    }
    const meta = {
      title: 'Home',
      head: {
        elements: [{
          tag: 'meta' as const,
          attributes: { name: 'route-owner', content: 'route' },
        }],
      },
    }
    const seenRoutes: PageRoute[] = []
    const seenSites: ResolvedSite[] = []

    function inspectSite(snapshot: ResolvedSite) {
      seenSites.push(snapshot)
      expect(Object.isFrozen(snapshot)).toBe(true)
      expect(Object.isFrozen(snapshot.navigation)).toBe(true)
      expect(Object.isFrozen(snapshot.navigation?.[0])).toBe(true)
      expect(Object.isFrozen(snapshot.head)).toBe(true)
      expect(Object.isFrozen(snapshot.head?.elements)).toBe(true)
      expect(Object.isFrozen(snapshot.head?.elements?.[0])).toBe(true)
      expect(Object.isFrozen(snapshot.head?.elements?.[0]?.attributes)).toBe(true)
      expect(Reflect.set(snapshot, 'title', 'Changed')).toBe(false)
      expect(Reflect.set(snapshot.navigation?.[0] ?? {}, 'label', 'Changed')).toBe(false)
      expect(Reflect.set(
        snapshot.head?.elements?.[0]?.attributes ?? {},
        'content',
        'changed',
      )).toBe(false)
    }

    function inspectRoute(snapshot: PageRoute) {
      seenRoutes.push(snapshot)
      expect(Object.keys(snapshot).sort()).toEqual([
        'kind',
        'meta',
        'path',
        'source',
        'status',
      ])
      expect(snapshot).not.toHaveProperty('component')
      expect(snapshot).not.toHaveProperty('data')
      expect(snapshot).not.toHaveProperty('frontmatter')
      expect(snapshot).not.toHaveProperty('content')
      expect(snapshot).not.toHaveProperty('layouts')
      expect(Object.isFrozen(snapshot)).toBe(true)
      expect(Object.isFrozen(snapshot.meta)).toBe(true)
      expect(Object.isFrozen(snapshot.meta.head)).toBe(true)
      expect(Object.isFrozen(snapshot.meta.head?.elements)).toBe(true)
      expect(Object.isFrozen(snapshot.meta.head?.elements?.[0]?.attributes)).toBe(true)
      expect(Reflect.set(snapshot, 'path', '/changed')).toBe(false)
      expect(Reflect.set(snapshot.meta, 'title', 'Changed')).toBe(false)
      expect(Reflect.set(
        snapshot.meta.head?.elements?.[0]?.attributes ?? {},
        'content',
        'changed',
      )).toBe(false)
    }

    function inspectPage(props: Pick<PageProps, 'route' | 'site'>) {
      inspectRoute(props.route)
      inspectSite(props.site)
    }

    function SnapshotPage(props: PageProps) {
      inspectPage(props)
      return <h1>{props.route.meta.title}</h1>
    }
    function SnapshotLayout(props: PageLayoutProps) {
      inspectPage(props)
      return <section>{props.children}</section>
    }
    function SnapshotShell(props: SiteShellProps) {
      inspectPage(props)
      return <main data-site={props.site.title}>{props.children}</main>
    }

    const snapshotPlugin = definePlugin({
      name: 'snapshot-inspector',
      routes(context) {
        inspectSite(context.site)
        const route = context.routes[0]
        if (route?.kind === 'page') {
          expect(Object.isFrozen(context.routes)).toBe(true)
          expect(Object.isFrozen(route.meta)).toBe(true)
        }
      },
      renderer(context) {
        inspectSite(context.site)
        return {
          head(pageContext) {
            inspectPage(pageContext)
          },
          wrapPage(page, pageContext) {
            inspectPage(pageContext)
            return page
          },
          async finalize(context) {
            inspectSite(context.site)
          },
        }
      },
    })
    const renderer = await createProjectRenderer({
      config: {
        site,
        shell: SnapshotShell,
        plugins: [snapshotPlugin],
      },
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/pages/page.tsx': {
          default: SnapshotPage,
          meta,
        },
      },
      folderLayouts: {
        '/src/pages/layout.tsx': { default: SnapshotLayout },
      },
      islandModules: {},
    })

    site.title = 'Changed input'
    site.navigation[0].label = 'Changed input'
    site.head.elements[0].attributes.content = 'changed-input'
    meta.title = 'Changed input'
    meta.head.elements[0].attributes.content = 'changed-input'

    const first = renderer.render('/')
    const second = renderer.render('/')
    expect(first).toEqual(second)
    expect(first).toMatchObject({
      kind: 'page',
      page: {
        html: '<main data-site="Site"><section><h1>Home</h1></section></main>',
      },
    })
    expect(new Set(seenRoutes).size).toBe(1)
    expect(new Set(seenSites).size).toBe(1)

    await renderer.finalize({
      clientDirectory: '/tmp/client',
      publication: createPublicationManifest('/', 'ignore', []),
    })
    expect(new Set(seenSites).size).toBe(1)
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
