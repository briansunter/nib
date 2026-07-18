import { describe, expect, it } from 'vitest'
import { createRoutes, getRoute } from '../src/framework/router'
import type { PageModule } from '../src/framework/types'

const Page = () => <p>page</p>
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
  it('generates a fallback when no custom 404 exists', () => {
    const route = getRoute(new Map(), '/missing')
    expect(route.status).toBe(404)
    expect(route.source).toBe('generated')
  })
})
