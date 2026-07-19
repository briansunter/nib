import { describe, expect, it } from 'vitest'
import { createRoutes, getRoute } from '../src/framework/router'
import type { PageModule } from '../src/framework/types'

const Page = () => <p>page</p>
const RootLayout = () => null
const DocsLayout = () => null
const NamedLayout = () => null
const site = { title: 'Site', description: 'Description' }

describe('router', () => {
  it('creates and resolves routes', () => {
    const routes = createRoutes({ '../pages/page.tsx': { default: Page }, '../pages/404/page.tsx': { default: Page } }, site)
    expect(getRoute(routes, '/').status).toBe(200)
    expect(getRoute(routes, '/missing').status).toBe(404)
  })
  it('skips drafts', () => {
    const routes = createRoutes({ '../pages/draft/page.tsx': { default: Page, meta: { draft: true } } }, site)
    expect(routes.has('/draft')).toBe(false)
  })
  it('rejects duplicate React and Markdown routes', () => {
    const modules: Record<string, PageModule> = {
      '../pages/about/page.tsx': { default: Page },
      '../pages/about/page.md': { default: Page }
    }
    expect(() => createRoutes(modules, site)).toThrow('Duplicate route /about')
  })
  it('rejects duplicate routes regardless of draft or module order', () => {
    const draft = { default: Page, meta: { draft: true } }
    const published = { default: Page }

    expect(() => createRoutes({
      '../pages/x/page.md': draft,
      '../pages/x/page.tsx': published,
    }, site)).toThrow('Duplicate route /x')
    expect(() => createRoutes({
      '../pages/x/page.tsx': published,
      '../pages/x/page.md': draft,
    }, site)).toThrow('Duplicate route /x')
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
            layout: 'product',
          },
          {
            path: '/products/notebook',
            component: Page,
            data: { name: 'Notebook' },
          },
        ],
      },
    }, site, {
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
})
