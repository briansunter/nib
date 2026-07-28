import { describe, expect, it } from 'vitest'
import { createRoutes, getRoute } from '../src/framework/router'
import type { PageModule } from '../src/framework/types'

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

  it('requires every page to define a non-empty title', () => {
    expect(() => createRoutes({
      '../pages/page.tsx': { default: Page },
    })).toThrow('must define a non-empty title')
  })
})
