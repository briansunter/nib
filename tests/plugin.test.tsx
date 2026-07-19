import { createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { definePlugin } from '../src/plugin'
import { validateNibConfig } from '../src/framework/project-config'
import { createProjectRenderer } from '../src/framework/project-renderer'

const Page = () => <h1>Home</h1>

describe('Nib plugins', () => {
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
  })

  it('wraps, transforms, and finalizes pages in deterministic plugin order', async () => {
    const events: string[] = []
    const first = definePlugin({
      name: 'first',
      renderer(context) {
        expect(context.mode).toBe('production')
        return {
          wrapPage(page) {
            events.push('first-wrap')
            return <div data-plugin="first">{page}</div>
          },
          transformPage(page, context) {
            events.push(`first-transform:${context.route.path}`)
            return { ...page, head: `${page.head}\n<meta name="first" content="yes" />` }
          },
          async finalize(context) {
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
      config: { site: { title: 'Site' }, plugins: [first, second] },
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
      root: '/ignored',
      base: '/ignored/',
      clientDirectory: '/tmp/client',
      renderedPaths: [],
    })
    expect(events).toEqual([
      'second-wrap',
      'first-wrap',
      'first-transform:/',
      'second-transform',
      'first-finalize:/',
    ])
    await expect(renderer.finalize({
      root: process.cwd(), base: '/', clientDirectory: '/tmp/client', renderedPaths: [],
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
})
