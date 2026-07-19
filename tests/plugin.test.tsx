import { createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { definePlugin } from '../src/plugin'
import { flattenVitePlugins } from '../src/framework/plugin'
import { defineIsland } from '../src/framework/islands'
import { validateNibConfig } from '../src/framework/project-config'
import { createProjectRenderer } from '../src/framework/project-renderer'

const Page = () => <h1>Home</h1>
const Counter = defineIsland('counter', () => <button>Count</button>)
const IslandPage = () => <Counter />

describe('Nib plugins', () => {
  it('resolves recursive Vite plugin promises without changing order', async () => {
    const owner = definePlugin({ name: 'vite-owner' })
    const plugins = await flattenVitePlugins([
      Promise.resolve({ name: 'first-vite' }),
      [false, Promise.resolve({ name: 'second-vite' })],
    ], owner)
    expect(plugins.map((plugin) => plugin.name)).toEqual(['first-vite', 'second-vite'])
  })

  it('validates names and hook shapes before Vite starts', () => {
    expect(() => validateNibConfig({ site: { title: 'Site' }, plugins: [{}] }))
      .toThrow('non-empty name')
    expect(() => validateNibConfig({
      site: { title: 'Site' },
      plugins: [{ name: 'same' }, { name: 'same' }],
    })).toThrow('duplicated')
    expect(() => validateNibConfig({
      site: { title: 'Site' },
      plugins: [{ name: 'invalid', renderer: true }],
    })).toThrow('renderer hook must be a function')
    expect(() => validateNibConfig({
      site: { title: 'Site' },
      plugins: [{ name: ' padded ' }],
    })).toThrow('non-empty name')
  })

  it('wraps, transforms, and finalizes pages in deterministic plugin order', async () => {
    const events: string[] = []
    const first = definePlugin({
      name: 'first',
      renderer(context) {
        expect(context.mode).toBe('production')
        expect(Object.isFrozen(context.site)).toBe(true)
        expect(Object.isFrozen(context.site.navigation)).toBe(true)
        return {
          wrapPage(page) {
            events.push('first-wrap')
            return <div data-plugin="first">{page}</div>
          },
          transformPage(page, context) {
            events.push(`first-transform:${context.route.path}`)
            expect(context.command).toBe('build')
            expect(Object.isFrozen(page)).toBe(true)
            return { ...page, head: `${page.head}\n<meta name="first" content="yes" />` }
          },
          async finalize(context) {
            expect(context.command).toBe('build')
            expect(context.mode).toBe('production')
            expect(context.site.title).toBe('Site')
            expect(Object.isFrozen(context.renderedPaths)).toBe(true)
            events.push(`first-finalize:${context.renderedPaths.join(',')}`)
          },
        }
      },
    })
    const second = definePlugin({
      name: 'second',
      renderer() {
        return {
          wrapPage(page) {
            events.push('second-wrap')
            return <section data-plugin="second">{page}</section>
          },
          transformPage(page) {
            events.push('second-transform')
            return { ...page, html: `${page.html}<aside>transformed</aside>` }
          },
        }
      },
    })
    const renderer = await createProjectRenderer({
      config: {
        site: { title: 'Site', navigation: [{ label: 'Home', href: '/' }] },
        plugins: [first, second],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })

    const page = renderer.render('/')
    expect(page.html).toBe(
      '<div data-plugin="first"><section data-plugin="second"><header><a href="/">Site</a></header><main><h1>Home</h1></main></section></div><aside>transformed</aside>',
    )
    expect(page.head).toContain('name="first"')
    await renderer.finalize({
      clientDirectory: '/tmp/client',
    })
    expect(events).toEqual([
      'second-wrap',
      'first-wrap',
      'first-transform:/',
      'second-transform',
      'first-finalize:/',
    ])
    await expect(renderer.finalize({
      clientDirectory: '/tmp/client',
    })).rejects.toThrow('only finalize once')
    expect(() => renderer.render('/')).toThrow('cannot render after finalization')
  })

  it('attributes render hook failures to the originating plugin and route', async () => {
    const renderer = await createProjectRenderer({
      config: {
        site: { title: 'Site' },
        plugins: [definePlugin({
          name: 'broken',
          renderer: () => ({ wrapPage: () => { throw new Error('original') } }),
        })],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })
    expect(() => renderer.render('/')).toThrow('Nib plugin broken failed in wrapPage() for route /')
  })

  it('rejects invalid status codes and post-render island markup mutations', async () => {
    const invalidStatus = await createProjectRenderer({
      config: {
        site: { title: 'Site' },
        plugins: [definePlugin({
          name: 'invalid-status',
          renderer: () => ({ transformPage: (page) => ({ ...page, status: 999 }) }),
        })],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })
    expect(() => invalidStatus.render('/')).toThrow('returned an invalid rendered page')

    const informationalStatus = await createProjectRenderer({
      config: {
        site: { title: 'Site' },
        plugins: [definePlugin({
          name: 'informational-status',
          renderer: () => ({ transformPage: (page) => ({ ...page, status: 199 }) }),
        })],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })
    expect(() => informationalStatus.render('/')).toThrow('returned an invalid rendered page')

    const invalidIslands = await createProjectRenderer({
      config: {
        site: { title: 'Site' },
        plugins: [definePlugin({
          name: 'invalid-islands',
          renderer: () => ({
            transformPage: (page) => ({ ...page, html: page.html.replace('<nib-island', '<removed-island') }),
          }),
        })],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: IslandPage } },
      islandModules: { '/src/islands/counter.tsx': { default: Counter } },
    })
    expect(() => invalidIslands.render('/')).toThrow('cannot change React island markup')
  })
})
