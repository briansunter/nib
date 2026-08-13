import { describe, expect, it } from 'vitest'
import {
  addConfiguredRedirects,
  addPluginRoutes,
  createRoutes,
  getRoute,
} from '../src/framework/router'
import type { PageModule, ResolvedRoute } from '../src/framework/types'

const Page = () => <p>page</p>
const RootLayout = () => null
const DocsLayout = () => null
const NamedLayout = () => null
describe('router', () => {
  it('creates and resolves routes', () => {
    const routes = createRoutes({
      '../pages/page.tsx': { default: Page, meta: { title: 'Home' } },
      '../pages/404/page.tsx': { default: Page, meta: { title: 'Not found' } },
    })
    expect(getRoute(routes, '/').status).toBe(200)
    expect(getRoute(routes, '/missing').status).toBe(404)
  })
  it('skips drafts', () => {
    const routes = createRoutes({
      '../pages/draft/page.tsx': { default: Page, meta: { title: 'Draft', draft: true } },
    })
    expect(routes.has('/draft')).toBe(false)
  })
  it('allows a page source to produce no routes', () => {
    expect(createRoutes({
      '/src/content/empty.json': { pages: [] },
    })).toEqual(new Map())
  })
  it('rejects duplicate React and Markdown routes', () => {
    const modules: Record<string, PageModule> = {
      '../pages/about/page.tsx': { default: Page, meta: { title: 'About TSX' } },
      '../pages/about/page.md': { default: Page, meta: { title: 'About Markdown' } },
    }
    expect(() => createRoutes(modules)).toThrow('Duplicate route /about')
  })
  it('rejects duplicate routes regardless of draft or module order', () => {
    const draft = { default: Page, meta: { title: 'Draft', draft: true } }
    const published = { default: Page, meta: { title: 'Published' } }

    expect(() => createRoutes({
      '../pages/x/page.md': draft,
      '../pages/x/page.tsx': published,
    })).toThrow('Duplicate route /x')
    expect(() => createRoutes({
      '../pages/x/page.tsx': published,
      '../pages/x/page.md': draft,
    })).toThrow('Duplicate route /x')
  })
  it('generates a fallback when no custom 404 exists', () => {
    const route = getRoute(new Map(), '/missing')
    expect(route.status).toBe(404)
    expect(route.source).toBe('generated')
  })
  it('expands generated pages and composes folder and named layouts', () => {
    const routes = createRoutes({
      '../pages/catalog/page.csv': {
        pages: [
          {
            path: '/products/pencil',
            component: Page,
            data: { name: 'Pencil' },
            meta: { title: 'Pencil' },
            layout: 'product',
          },
          {
            path: '/products/notebook',
            component: Page,
            data: { name: 'Notebook' },
            meta: { title: 'Notebook' },
          },
        ],
      },
    }, {
      folders: {
        '../pages/layout.tsx': { default: RootLayout },
        '../pages/catalog/layout.tsx': { default: DocsLayout },
      },
      named: {
        '../layouts/product.tsx': { default: NamedLayout },
      },
    })

    expect(routes.get('/products/pencil')?.data).toEqual({ name: 'Pencil' })
    expect(routes.get('/products/pencil')?.layouts)
      .toEqual([RootLayout, DocsLayout, NamedLayout])
    expect(routes.get('/products/notebook')?.layouts)
      .toEqual([RootLayout, DocsLayout])
  })

  it('accepts generated routes from non-page source files without folder layouts', () => {
    const routes = createRoutes({
      '/src/content/projects.json': {
        pages: [{
          path: '/projects/one',
          component: Page,
          data: { name: 'One' },
          meta: { title: 'One' },
        }],
      },
    }, {
      folders: { '../pages/layout.tsx': { default: RootLayout } },
    })
    expect(routes.get('/projects/one')?.data).toEqual({ name: 'One' })
    expect(routes.get('/projects/one')?.layouts).toEqual([])
  })

  it('rejects protocol-relative generated routes instead of normalizing their host away', () => {
    expect(() => createRoutes({
      '/src/content/projects.json': {
        pages: [{
          path: '//evil.example/project',
          component: Page,
          data: {},
          meta: { title: 'Project' },
        }],
      },
    })).toThrow('protocol-relative')
  })

  it.each([
    ['relative', 'absolute route path'],
    ['/products//pencil', 'repeated slashes'],
    ['/products/pencil?draft=1', 'no query'],
    ['/products/pencil#details', 'no query, hash'],
    ['/products\\pencil', 'no query, hash, or backslash'],
    ['/products/../pencil', 'no dot segments'],
    ['/products/%2e%2e/pencil', 'no dot segments'],
    ['/products%2Fpencil', 'no encoded path separators'],
    ['/old\npath', 'no control characters'],
    ['/old\0path', 'no control characters'],
    ['/old%0Apath', 'no encoded control characters'],
    ['/old%7Fpath', 'no encoded control characters'],
    ['/pr%6Fducts', 'no encoded unreserved characters'],
    ['/products/%zz', 'valid URL encoding'],
  ])('rejects malformed generated route identity %s', (path, message) => {
    expect(() => createRoutes({
      '/src/content/projects.json': {
        pages: [{
          path,
          component: Page,
          data: {},
          meta: { title: 'Project' },
        }],
      },
    })).toThrow(message)
  })

  it('keeps encoded spaces as an unambiguous route identity', () => {
    const routes = createRoutes({
      '/src/content/projects.json': {
        pages: [{
          path: '/hello%20world',
          component: Page,
          data: {},
          meta: { title: 'Hello world' },
        }],
      },
    })

    expect(routes.has('/hello%20world')).toBe(true)
  })

  it('requires every page to define a non-empty title', () => {
    expect(() => createRoutes({
      '../pages/page.tsx': { default: Page },
    })).toThrow('must define a non-empty title')
  })

  it('validates draft metadata before deciding whether to omit a page', () => {
    expect(() => createRoutes({
      '../pages/draft/page.tsx': {
        default: Page,
        meta: { title: 'Draft', draft: 'yes' } as never,
      },
    })).toThrow('draft must be a boolean')
  })

  it.each(['/old?preview=1', '/old#details'])(
    'rejects a configured local redirect whose pathname points to itself: %s',
    (destination) => {
      const routes = new Map<string, ResolvedRoute>()
      expect(() => addConfiguredRedirects(routes, { '/old': destination }))
        .toThrow('cannot redirect to itself')
    },
  )

  it('rejects an encoded-unreserved configured redirect alias', () => {
    expect(() => addConfiguredRedirects(
      new Map<string, ResolvedRoute>(),
      { '/old': '/%6Fld' },
    )).toThrow('no encoded unreserved characters')
  })

  it.each(['/other/../new', '/other/%2e%2e/new'])(
    'rejects dot segments in a configured redirect destination: %s',
    (destination) => {
      expect(() => addConfiguredRedirects(
        new Map<string, ResolvedRoute>(),
        { '/old': destination },
      )).toThrow('no dot segments')
    },
  )

  it('validates plugin route paths and metadata through the same seams', () => {
    const plugin = { name: 'invalid-routes' }
    expect(() => addPluginRoutes(new Map(), [{
      plugin,
      route: {
        kind: 'page',
        path: '/plugin//page',
        component: Page,
        meta: { title: 'Plugin page' },
      },
    }])).toThrow('repeated slashes')

    expect(() => addPluginRoutes(new Map(), [{
      plugin,
      route: {
        kind: 'page',
        path: '/plugin-page',
        component: Page,
        meta: { title: 'Plugin page', twitterCard: 'hero' } as never,
      },
    }])).toThrow('twitterCard must be summary or summary_large_image')
  })

  it('omits draft plugin pages after validating their metadata', () => {
    const routes = new Map<string, ResolvedRoute>()
    addPluginRoutes(routes, [{
      plugin: { name: 'draft-page' },
      route: {
        kind: 'page',
        path: '/plugin-draft',
        component: Page,
        meta: { title: 'Draft', draft: true },
      },
    }])
    expect(routes.has('/plugin-draft')).toBe(false)
  })

  it('rejects plugin redirect pathname self-loops with query or hash suffixes', () => {
    const plugin = { name: 'loop' }
    for (const destination of ['/same?preview=1', '/same#details']) {
      expect(() => addPluginRoutes(new Map(), [{
        plugin,
        route: {
          kind: 'redirect',
          path: '/same',
          destination,
        },
      }])).toThrow('cannot redirect to itself')
    }
  })

  it('rejects an encoded-unreserved plugin redirect alias', () => {
    expect(() => addPluginRoutes(new Map(), [{
      plugin: { name: 'encoded-loop' },
      route: {
        kind: 'redirect',
        path: '/old',
        destination: '/%6Fld',
      },
    }])).toThrow('no encoded unreserved characters')
  })
})
