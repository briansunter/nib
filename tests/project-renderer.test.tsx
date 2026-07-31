import { describe, expect, it } from 'vitest'
import { Behavior } from '../src/framework/behaviors'
import { createProjectRenderer } from '../src/framework/project-renderer'
import {
  defineCollection,
  defineDerivedPages,
  definePageSource,
  fromCollection,
  fromPageSource,
} from '../src/framework/content'
import { markdownBody, type ContentRenderer } from '../src/framework/markdown-content'
import type {
  PageLayoutProps,
  PageProps,
  PageRoute,
  SiteShellProps,
} from '../src/framework/types'
import { definePlugin } from '../src/framework/plugin'
import { createPublicationManifest } from '../src/framework/publication'
import { rss } from '../src/rss'

const Page = () => <h1>Home</h1>

describe('project renderer', () => {
  it('allows nested independent behavior ownership', async () => {
    function NestedPage() {
        return (
          <Behavior name="outer">
            <article>
              <Behavior name="inner"><p>Details</p></Behavior>
            </article>
          </Behavior>
        )
    }
    const renderer = await createProjectRenderer({
      config: {},
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/pages/page.tsx': {
          default: NestedPage,
          meta: { title: 'Invalid' },
        },
      },
      islandModules: {},
      behaviorClientFiles: [
        '/src/behaviors/outer.client.ts',
        '/src/behaviors/inner.client.ts',
      ],
    })

    const output = renderer.render('/')
    if (output.kind !== 'page') throw new Error('Expected page output')
    expect(output.page.behaviors).toEqual(['outer', 'inner'])
    expect(output.page.html).toContain('data-nib-behavior="inner"')
  })

  it('keeps draft data pages out of page-source collections', async () => {
    const source = definePageSource({
      extensions: ['json'],
      validate: (value) => value as { title: string },
      load: () => [],
      component: Page,
    })
    const posts = fromPageSource(source)
    const titles = fromCollection(posts, (entries) => (
      entries.map((entry) => entry.data.title)
    ))
    const renderer = await createProjectRenderer({
      config: {
        collections: { posts },
        plugins: [{
          name: 'collection-reader',
          routes({ readCollection }) {
            return {
              kind: 'resource',
              path: '/titles.json',
              contentType: 'application/json',
              body: JSON.stringify(readCollection(titles)),
            }
          },
        }],
      },
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/content/posts.json': {
          pages: [
            {
              path: '/published',
              component: Page,
              data: { title: 'Published' },
              meta: { title: 'Published' },
              sourceDefinition: source,
              collectionId: 'published',
            },
            {
              path: '/draft',
              component: Page,
              data: { title: 'Draft' },
              meta: { title: 'Draft', draft: true },
              sourceDefinition: source,
              collectionId: 'draft',
            },
          ],
        },
      },
      islandModules: {},
    })

    expect(renderer.render('/titles.json')).toMatchObject({
      kind: 'resource',
      body: '["Published"]',
    })
  })

  it('grants resource plugins mapped access to one immutable collection', async () => {
    const posts = defineCollection({
      loader: async () => [{ id: 'one', data: { title: 'One' } }],
      validate(value) {
        return value as { title: string }
      },
    })
    const renderer = await createProjectRenderer({
      config: {
        origin: 'https://example.test',
        collections: { posts },
        plugins: [rss({
          title: 'Site',
          description: 'Description',
          items: fromCollection(posts, (entries) => entries.map((entry) => ({
            title: entry.data.title,
            link: `/posts/${entry.id}`,
          }))),
        })],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page, meta: { title: 'Home' } } },
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
      pages: { '/src/pages/page.tsx': { default: Page, meta: { title: 'Home' } } },
      islandModules: {},
    })).rejects.toThrow('not registered by this site')
  })

  it('owns route setup and document data rendering behind one interface', async () => {
    const renderer = await createProjectRenderer({
      config: {},
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/pages/page.tsx': {
          default: Page,
          meta: { title: 'Site', description: 'Description' },
        },
      },
      islandModules: {},
    })

    expect(renderer.paths).toEqual(['/'])
    expect(renderer.render('/')).toMatchObject({
      kind: 'page',
      page: {
        status: 200,
        head: '<title>Site</title>\n    <meta name="description" content="Description" />',
        html: '<main><h1>Home</h1></main>',
        islands: [],
        behaviors: [],
      },
    })
  })

  it('publishes non-404 routes even when their response status is 404', async () => {
    const renderer = await createProjectRenderer({
      config: {
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
      pages: { '/src/pages/page.tsx': { default: Page, meta: { title: 'Home' } } },
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
    const body = await markdownBody('# Body', { file: '/src/pages/page.md' })
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
      config: {},
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/pages/page.md': {
          default: GeneratedMarkdownPage,
          meta: { title: 'Article' },
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

  it('shares deeply immutable public route snapshots across every render seam', async () => {
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

    function inspectPage(props: Pick<PageProps, 'route'>) {
      inspectRoute(props.route)
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
      return <main>{props.children}</main>
    }

    const snapshotPlugin = definePlugin({
      name: 'snapshot-inspector',
      routes(context) {
        expect(context.origin).toBe('https://example.test')
        const route = context.routes[0]
        if (route?.kind === 'page') {
          expect(Object.isFrozen(context.routes)).toBe(true)
          expect(Object.isFrozen(route.meta)).toBe(true)
        }
      },
      renderer(context) {
        expect(context.origin).toBe('https://example.test')
        return {
          head(pageContext) {
            inspectPage(pageContext)
          },
          wrapPage(page, pageContext) {
            inspectPage(pageContext)
            return page
          },
          async finalize(context) {
            expect(context.origin).toBe('https://example.test')
          },
        }
      },
    })
    const renderer = await createProjectRenderer({
      config: {
        origin: 'https://example.test',
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

    meta.title = 'Changed input'
    meta.head.elements[0].attributes.content = 'changed-input'

    const first = renderer.render('/')
    const second = renderer.render('/')
    expect(first).toEqual(second)
    expect(first).toMatchObject({
      kind: 'page',
      page: {
        html: '<main><section><h1>Home</h1></section></main>',
      },
    })
    expect(new Set(seenRoutes).size).toBe(1)

    await renderer.finalize({
      clientDirectory: '/tmp/client',
      publication: createPublicationManifest('/', 'ignore', []),
    })
  })

  it('enforces trailing slashes and configured redirects in development rendering', async () => {
    const renderer = await createProjectRenderer({
      config: {
        trailingSlash: 'never',
        redirects: {
          '/old': { destination: '/about/', status: 302 },
        },
      },
      root: process.cwd(),
      base: '/base/',
      pages: { '/src/pages/about/page.tsx': { default: Page, meta: { title: 'About' } } },
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

  it('generates one derived route per collection entry and renders its data', async () => {
    const things = defineCollection({
      loader: async () => [
        { id: 'one', data: { name: 'One', count: 1 } },
        { id: 'two', data: { name: 'Two', count: 2 } },
      ],
      validate: (value) => value as { name: string; count: number },
    })
    function ThingPage({ data }: { data: { name: string; count: number } }) {
      return <p>{data.name}:{data.count}</p>
    }
    const derived = defineDerivedPages({
      pages: fromCollection(things, (entries) => entries.map((entry) => ({
        path: `/things/${entry.id}`,
        data: entry.data,
        meta: { title: entry.data.name },
      }))),
      component: ThingPage,
    })
    const renderer = await createProjectRenderer({
      config: { collections: { things } },
      root: process.cwd(),
      base: '/',
      pages: {},
      islandModules: {},
      derivedPages: { definitions: [derived], components: [ThingPage] },
    })

    expect(renderer.paths).toEqual(['/things/one', '/things/two'])
    const output = renderer.render('/things/one')
    expect(output.kind).toBe('page')
    if (output.kind !== 'page') throw new Error('Expected page')
    expect(output.page.html).toBe('<main><p>One:1</p></main>')
    expect(output.page.head).toContain('<title>One</title>')
  })

  it('rejects two collection entries that map to the same derived route', async () => {
    const things = defineCollection({
      loader: async () => [
        { id: 'one', data: { name: 'One' } },
        { id: 'two', data: { name: 'Two' } },
      ],
      validate: (value) => value as { name: string },
    })
    function ThingPage({ data }: { data: { name: string } }) {
      return <p>{data.name}</p>
    }
    const derived = defineDerivedPages({
      pages: fromCollection(things, (entries) => entries.map((entry) => ({
        path: '/things/same',
        data: entry.data,
        meta: { title: entry.data.name },
      }))),
      component: ThingPage,
    })

    await expect(createProjectRenderer({
      config: { collections: { things } },
      root: process.cwd(),
      base: '/',
      pages: {},
      islandModules: {},
      derivedPages: { definitions: [derived], components: [ThingPage] },
    })).rejects.toThrow('Derived pages[0] produced duplicate route /things/same')
  })

  it('lets a markdown route and a derived route coexist without colliding', async () => {
    const body = await markdownBody('# Note', { file: '/src/pages/note/page.md' })
    function NotePage({ Content }: { Content?: ContentRenderer }) {
      return Content ? <Content /> : <p>fallback</p>
    }
    const things = defineCollection({
      loader: async () => [{ id: 'one', data: { name: 'One' } }],
      validate: (value) => value as { name: string },
    })
    function ThingPage({ data }: { data: { name: string } }) {
      return <p>{data.name}</p>
    }
    const derived = defineDerivedPages({
      pages: fromCollection(things, (entries) => entries.map((entry) => ({
        path: `/things/${entry.id}`,
        data: entry.data,
        meta: { title: entry.data.name },
      }))),
      component: ThingPage,
    })
    const renderer = await createProjectRenderer({
      config: { collections: { things } },
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/pages/note/page.md': {
          default: NotePage,
          meta: { title: 'Note' },
          content: body,
        },
      },
      islandModules: {},
      derivedPages: { definitions: [derived], components: [ThingPage] },
    })

    expect(renderer.paths).toEqual(['/note', '/things/one'])
    const note = renderer.render('/note')
    expect(note.kind).toBe('page')
    if (note.kind !== 'page') throw new Error('Expected page')
    expect(note.page.html).toContain('<h1>Note</h1>')
    const thing = renderer.render('/things/one')
    expect(thing.kind).toBe('page')
    if (thing.kind !== 'page') throw new Error('Expected page')
    expect(thing.page.html).toBe('<main><p>One</p></main>')
  })
})
