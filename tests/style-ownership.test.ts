import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pageStyleOwnershipGuard } from '../src/framework/style-ownership'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, {
    recursive: true,
    force: true,
  })))
})

async function resolveEdge(
  target: 'client' | 'server' | 'development',
  source: string,
  importer: string,
  resolved = source,
) {
  const plugin = pageStyleOwnershipGuard('/site', target)
  if (typeof plugin.resolveId !== 'function') throw new Error('Style guard has no resolveId hook')
  return plugin.resolveId.call({
    resolve: vi.fn(async () => ({ id: resolved })),
  } as never, source, importer, {} as never)
}

describe('page stylesheet ownership', () => {
  it.each([
    '/site/src/pages/about/page.tsx',
    '/site/src/pages/about/layout.tsx',
    '/site/src/layouts/article.tsx',
    '/site/src/data-pages.tsx',
    '/site/src/components/card.tsx',
  ])('rejects server-only CSS imported by %s', async (id) => {
    await expect(resolveEdge('server', './page.css', id))
      .rejects.toThrow(/cannot deploy stylesheet.*page\.css.*Move the import to src\/style\.css/)
    await expect(resolveEdge('development', './page.css', id))
      .rejects.toThrow('Route-scoped page CSS is not supported')
  })

  it('allows styles owned by deployable client graphs', async () => {
    await expect(resolveEdge('client', './page.css', '/site/src/pages/page.tsx'))
      .resolves.toBeNull()
    await expect(resolveEdge('server', './counter.css', '/site/src/islands/counter.tsx'))
      .resolves.toBeNull()
    await expect(resolveEdge('server', './map.css', '/site/src/behaviors/map.client.ts'))
      .resolves.toBeNull()
    await expect(resolveEdge('server', './legacy.css', '/site/src/behaviors/legacy.client.js'))
      .resolves.toBeNull()
    await expect(resolveEdge('server', './tokens.css', '/site/src/style.css'))
      .resolves.toBeNull()
    await expect(resolveEdge('server', './plugin.css', '/plugin/index.ts'))
      .resolves.toBeNull()
  })

  it('tracks plugin-owned client-entry imports through their resolved graph', async () => {
    const plugin = pageStyleOwnershipGuard('/site', 'development')
    if (typeof plugin.resolveId !== 'function') throw new Error('Style guard has no resolveId hook')
    const context = {
      resolve: vi.fn(async (source: string) => ({
        id: source === './client-entry'
          ? '/site/src/utils/client-entry.ts'
          : '/site/src/styles/plugin.css',
      })),
    } as never
    await expect(plugin.resolveId.call(
      context,
      './client-entry',
      '\0virtual:nib/enhancement-entry',
      {} as never,
    )).resolves.toBeNull()
    await expect(plugin.resolveId.call(
      context,
      '../styles/plugin.css',
      '/site/src/utils/client-entry.ts',
      {} as never,
    )).resolves.toBeNull()
  })

  it('uses the resolved module identity for aliases and query strings', async () => {
    await expect(resolveEdge(
      'server',
      '@styles/article',
      '/site/src/pages/page.tsx',
      '/site/src/styles/article.css?inline',
    )).rejects.toThrow('@styles/article')
  })

  it('checks static and dynamic import edges while non-import text creates no edge', async () => {
    await expect(resolveEdge('server', './static.css', '/site/src/pages/page.tsx'))
      .rejects.toThrow('static.css')
    await expect(resolveEdge('server', './dynamic.css', '/site/src/pages/page.tsx'))
      .rejects.toThrow('dynamic.css')

    // Vite invokes resolveId only for parsed module edges. Comments and
    // ordinary strings therefore never enter this ownership hook.
    const plugin = pageStyleOwnershipGuard('/site', 'server')
    expect(plugin.transform).toBeUndefined()
  })

  it('lets Vite ignore import-like comments and strings but rejects a real dynamic edge', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-style-ownership-'))
    temporaryRoots.push(root)
    const sourceRoot = path.join(root, 'src/pages')
    await fs.mkdir(sourceRoot, { recursive: true })
    const entry = path.join(sourceRoot, 'page.ts')
    await fs.writeFile(entry, [
      `// import './commented.css'`,
      `const example = "import './string.css'"`,
      'export default example',
    ].join('\n'))
    const config = {
      configFile: false as const,
      logLevel: 'silent' as const,
      root,
      plugins: [pageStyleOwnershipGuard(root, 'server')],
      build: {
        write: false,
        rollupOptions: { input: entry },
      },
    }
    await expect(build(config)).resolves.toBeDefined()

    await fs.writeFile(path.join(sourceRoot, 'real.css'), 'body {}')
    await fs.writeFile(entry, `void import('./real.css')`)
    await expect(build(config)).rejects.toThrow('real.css')
  })
})
