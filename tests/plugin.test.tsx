import { describe, expect, it } from 'vitest'
import { definePlugin } from '../src/plugin'
import { flattenVitePlugins } from '../src/framework/plugin'
import { clientNavigation } from '../src/navigation'
import { configuredClientEntries } from '../src/framework/plugin-contributions'
import { validateNibConfig } from '../src/framework/project-config'
import { createProjectRenderer } from '../src/framework/project-renderer'
import { createPublicationManifest } from '../src/framework/publication'

const Page = () => <h1>Home</h1>

describe('Nib plugins', () => {
  it('keeps client entries declarative, immutable, and validated once with their owners', () => {
    const client = validateNibConfig({
      plugins: [clientNavigation()],
    })
    expect(configuredClientEntries(client)).toEqual([{
      module: '@briansunter/nib/client/navigation',
      initializer: 'initializeClientNavigation',
    }])
    expect(Object.isFrozen(configuredClientEntries(client))).toBe(true)

    const explicitClient = validateNibConfig({
      plugins: [clientNavigation({ prefetch: 'explicit' })],
    })
    expect(configuredClientEntries(explicitClient)).toEqual([{
      module: '@briansunter/nib/client/navigation',
      initializer: 'initializeExplicitClientNavigation',
    }])

    expect(() => validateNibConfig({
      plugins: [{
        name: 'invalid-client-entry',
        clientEntries: [{ module: 'browser', initializer: 'not-valid()' }],
      }],
    })).toThrow('JavaScript initializer name')
    expect(() => validateNibConfig({
      plugins: [
        {
          name: 'first-owner',
          clientEntries: [{ module: 'browser', initializer: 'start' }],
        },
        {
          name: 'second-owner',
          clientEntries: [{ module: 'browser', initializer: 'start' }],
        },
      ],
    })).toThrow('duplicated by first-owner and second-owner')
  })

  it('resolves recursive Vite plugin promises without changing order', async () => {
    const owner = definePlugin({ name: 'vite-owner' })
    const plugins = await flattenVitePlugins([
      Promise.resolve({ name: 'first-vite' }),
      [false, Promise.resolve({ name: 'second-vite' })],
    ], owner)
    expect(plugins.map((plugin) => plugin.name)).toEqual(['first-vite', 'second-vite'])
  })

  it('validates names and hook shapes before Vite starts', () => {
    expect(() => validateNibConfig({ plugins: [{}] }))
      .toThrow('non-empty name')
    expect(() => validateNibConfig({
      plugins: [{ name: 'same' }, { name: 'same' }],
    })).toThrow('duplicated')
    expect(() => validateNibConfig({
      plugins: [{ name: 'invalid', renderer: true }],
    })).toThrow('renderer hook must be a function')
    expect(() => validateNibConfig({
      plugins: [{ name: 'invalid', setup: () => undefined }],
    })).toThrow('unsupported field setup')
    expect(() => validateNibConfig({
      plugins: [{ name: 'invalid', pageSources: {} }],
    })).toThrow('pageSources must be an array')
    expect(() => validateNibConfig({
      plugins: [{ name: 'invalid', clientEntries: {} }],
    })).toThrow('clientEntries must be an array')
    expect(() => validateNibConfig({
      plugins: [{ name: ' padded ' }],
    })).toThrow('non-empty name')
  })

  it('contributes head data, wraps, and finalizes in deterministic plugin order', async () => {
    const events: string[] = []
    const first = definePlugin({
      name: 'first',
      renderer(context) {
        expect(context.mode).toBe('production')
        expect(context.origin).toBe('https://example.test')
        return {
          head() {
            events.push('first-head')
            return {
              title: 'First title',
              elements: [{ tag: 'meta', attributes: { name: 'first', content: 'yes' } }],
            }
          },
          wrapPage(page) {
            events.push('first-wrap')
            return <div data-plugin="first">{page}</div>
          },
          async finalize(context) {
            expect(context.command).toBe('build')
            expect(context.mode).toBe('production')
            expect(context.origin).toBe('https://example.test')
            expect(Object.isFrozen(context.publication)).toBe(true)
            expect(Object.isFrozen(context.publication.routes)).toBe(true)
            events.push('first-finalize')
          },
        }
      },
    })
    const second = definePlugin({
      name: 'second',
      renderer() {
        return {
          head() {
            events.push('second-head')
            return {
              title: 'Second title',
              description: 'Second description',
            }
          },
          wrapPage(page) {
            events.push('second-wrap')
            return <section data-plugin="second">{page}</section>
          },
        }
      },
    })
    const renderer = await createProjectRenderer({
      config: {
        origin: 'https://example.test',
        plugins: [first, second],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page, meta: { title: 'Home' } } },
    })

    const output = renderer.render('/')
    if (output.kind !== 'page') throw new Error('Expected a page output')
    expect(output.page.html).toBe(
      '<div data-plugin="first"><section data-plugin="second"><main><h1>Home</h1></main></section></div>',
    )
    expect(output.page.head).toContain('name="first"')
    expect(output.page.head).toContain('<title>Second title</title>')
    expect(output.page.head).toContain('content="Second description"')
    await renderer.finalize({
      clientDirectory: '/tmp/client',
      publication: createPublicationManifest('/', 'ignore', []),
    })
    expect(events).toEqual([
      'first-head',
      'second-head',
      'second-wrap',
      'first-wrap',
      'first-finalize',
    ])
    await expect(renderer.finalize({
      clientDirectory: '/tmp/client',
      publication: createPublicationManifest('/', 'ignore', []),
    })).rejects.toThrow('only finalize once')
    expect(() => renderer.render('/')).toThrow('cannot render after finalization')
  })

  it('lets renderer plugins add structured head elements with route context', async () => {
    const renderer = await createProjectRenderer({
      config: {
        plugins: [definePlugin({
          name: 'head-plugin',
          renderer() {
            return {
              head(context) {
                expect(context.route.path).toBe('/')
                return {
                  elements: [{
                    tag: 'link',
                    attributes: { rel: 'canonical', href: 'https://example.test/' },
                  }],
                }
              },
            }
          },
        })],
      },
      root: process.cwd(),
      base: '/',
      pages: {
        '/src/pages/page.tsx': {
          default: Page,
          meta: {
            title: 'Home',
            head: {
              elements: [{ tag: 'meta', attributes: { name: 'page', content: 'yes' } }],
            },
          },
        },
      },
    })
    const output = renderer.render('/')
    if (output.kind !== 'page') throw new Error('Expected a page output')
    expect(output.page.head).toContain('name="page"')
    expect(output.page.head).toContain('rel="canonical"')
  })

  it('registers routes in plugin order against the latest immutable manifest', async () => {
    const first = definePlugin({
      name: 'first-routes',
      routes(context) {
        expect(context.routes.map((route) => route.path)).toEqual(['/'])
        return {
          kind: 'resource',
          path: '/first.xml',
          body: '<first />',
          contentType: 'application/xml',
        }
      },
    })
    const second = definePlugin({
      name: 'second-routes',
      routes(context) {
        expect(context.routes.map((route) => route.path)).toEqual(['/', '/first.xml'])
        return {
          kind: 'page',
          path: '/virtual',
          component: Page,
          meta: { title: 'Virtual' },
        }
      },
    })
    const renderer = await createProjectRenderer({
      config: {
        plugins: [first, second],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page, meta: { title: 'Home' } } },
    })

    expect(renderer.paths).toEqual(['/', '/first.xml', '/virtual'])
    expect(renderer.render('/first.xml')).toEqual({
      kind: 'resource',
      status: 200,
      body: '<first />',
      contentType: 'application/xml',
    })
    expect(renderer.render('/virtual')).toMatchObject({ kind: 'page' })
  })

  it('rejects duplicate plugin routes with both owners', async () => {
    const duplicate = (name: string) => definePlugin({
      name,
      routes: () => ({
        kind: 'resource' as const,
        path: '/same.xml',
        body: '',
        contentType: 'application/xml',
      }),
    })
    await expect(createProjectRenderer({
      config: {
        plugins: [duplicate('one'), duplicate('two')],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page, meta: { title: 'Home' } } },
    })).rejects.toThrow('Duplicate route /same.xml: one routes()[0] and two routes()[0]')
  })

  it('attributes render hook failures to the originating plugin and route', async () => {
    const renderer = await createProjectRenderer({
      config: {
        plugins: [definePlugin({
          name: 'broken',
          renderer: () => ({ wrapPage: () => { throw new Error('original') } }),
        })],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page, meta: { title: 'Home' } } },
    })
    expect(() => renderer.render('/')).toThrow('Nib plugin broken failed in wrapPage() for route /')
  })

})
