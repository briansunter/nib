import { describe, expect, it } from 'vitest'
import { pageStyleOwnershipGuard } from '../src/framework/style-ownership'

function transform(target: 'client' | 'server' | 'development', code: string, id: string) {
  const plugin = pageStyleOwnershipGuard('/site', target)
  if (typeof plugin.transform !== 'function') throw new Error('Style guard has no transform hook')
  return plugin.transform.call({} as never, code, id, {} as never)
}

describe('page stylesheet ownership', () => {
  it.each([
    '/site/src/pages/about/page.tsx',
    '/site/src/pages/about/layout.tsx',
    '/site/src/layouts/article.tsx',
    '/site/src/data-pages.tsx',
    '/site/src/components/card.tsx',
  ])('rejects server-only CSS imported by %s', (id) => {
    expect(() => transform('server', "import './page.css'", id))
      .toThrow(/cannot deploy stylesheet.*page\.css.*Move the import to src\/style\.css/)
    expect(() => transform('development', "import styles from './page.css'", id))
      .toThrow('Route-scoped page CSS is not supported')
  })

  it('allows styles owned by deployable client graphs', () => {
    expect(transform('client', "import './page.css'", '/site/src/pages/page.tsx')).toBeNull()
    expect(transform('server', "import './counter.css'", '/site/src/islands/counter.tsx')).toBeNull()
    expect(transform(
      'server',
      "import './map.css'",
      '/site/src/behaviors/map.client.ts',
    )).toBeNull()
    expect(transform('server', '@import "./tokens.css";', '/site/src/style.css')).toBeNull()
    expect(transform('server', "import './plugin.css'", '/plugin/index.ts')).toBeNull()
  })

  it('detects dynamic stylesheet imports instead of silently splitting them', () => {
    expect(() => transform(
      'server',
      "const load = () => import('./late.css')",
      '/site/src/pages/page.tsx',
    )).toThrow('late.css')
  })
})
