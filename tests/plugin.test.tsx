import { describe, expect, it } from 'vitest'
import { definePlugin } from '../src/plugin'
import {
  flattenVitePlugins,
  resolvePluginSetupContributions,
} from '../src/framework/plugin'
import { defineIsland } from '../src/framework/islands'
import { defineClientBehavior } from '../src/framework/behaviors'
import { clientNavigation } from '../src/navigation'
import { validateNibConfig } from '../src/framework/project-config'
import { createProjectRenderer } from '../src/framework/project-renderer'
import { createPublicationManifest } from '../src/framework/publication'

const Page = () => <h1>Home</h1>
const Counter = defineIsland('counter', () => <button>Count</button>)
const IslandPage = () => <Counter />
const Reveal = defineClientBehavior<{ label: string }>('reveal')
const BehaviorPage = () => (
  <>
    <Reveal props={{ label: 'outer' }}>
      <div>
        <Reveal props={{ label: 'inner' }}><button>Inner</button></Reveal>
      </div>
    </Reveal>
    <Reveal props={{ label: 'second' }}><p>Second</p></Reveal>
  </>
)

describe('Nib plugins', () => {
  it('labels the two deterministic page-source setup phases', async () => {
    const phases: string[] = []
    const plugin = definePlugin({
      name: 'setup-phases',
      setup(context) {
        phases.push(context.phase)
      },
    })
    const base = {
      command: 'build' as const,
      mode: 'production' as const,
      target: 'server' as const,
      root: '/site',
      base: '/',
      configPath: '/site/nib.config.ts',
    }
    await resolvePluginSetupContributions(
      [plugin],
      Object.freeze({ ...base, phase: 'vite-config' as const }),
    )
    await resolvePluginSetupContributions(
      [plugin],
      Object.freeze({ ...base, phase: 'page-source-module' as const }),
    )
    expect(phases).toEqual(['vite-config', 'page-source-module'])
  })

  it('keeps optional client entries declarative, validated, and target-specific', async () => {
    const base = {
      command: 'build' as const,
      mode: 'production' as const,
      root: '/site',
      base: '/',
      configPath: '/site/nib.config.ts',
      phase: 'vite-config' as const,
    }
    const client = await resolvePluginSetupContributions(
      [clientNavigation()],
      Object.freeze({ ...base, target: 'client' as const }),
    )
    expect(client.clientEntries).toEqual([{
      module: '@briansunter/nib/client/navigation',
      initializer: 'startClientNavigation',
    }])
    expect(Object.isFrozen(client.clientEntries)).toBe(true)
    const explicitClient = await resolvePluginSetupContributions(
      [clientNavigation({ prefetch: 'explicit' })],
      Object.freeze({ ...base, target: 'client' as const }),
    )
    expect(explicitClient.clientEntries).toEqual([{
      module: '@briansunter/nib/client/navigation',
      initializer: 'startExplicitClientNavigation',
    }])

    const server = await resolvePluginSetupContributions(
      [clientNavigation()],
      Object.freeze({ ...base, target: 'server' as const }),
    )
    expect(server.clientEntries).toEqual([])

    const invalid = definePlugin({
      name: 'invalid-client-entry',
      setup: () => ({
        clientEntries: [{ module: 'browser', initializer: 'not-valid()' }],
      }),
    })
    await expect(resolvePluginSetupContributions(
      [invalid],
      Object.freeze({ ...base, target: 'client' as const }),
    )).rejects.toThrow('JavaScript initializer name')
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
      plugins: [{ name: 'invalid', routesResolved: true }],
    })).toThrow('routesResolved hook must be a function')
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
            expect(Object.isFrozen(context.publication)).toBe(true)
            expect(Object.isFrozen(context.publication.routes)).toBe(true)
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

    const output = renderer.render('/')
    if (output.kind !== 'page') throw new Error('Expected a page output')
    expect(output.page.html).toBe(
      '<div data-plugin="first"><section data-plugin="second"><header><a href="/">Site</a></header><main><h1>Home</h1></main></section></div><aside>transformed</aside>',
    )
    expect(output.page.head).toContain('name="first"')
    await renderer.finalize({
      clientDirectory: '/tmp/client',
      publication: createPublicationManifest('/', 'ignore', []),
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
      publication: createPublicationManifest('/', 'ignore', []),
    })).rejects.toThrow('only finalize once')
    expect(() => renderer.render('/')).toThrow('cannot render after finalization')
  })

  it('lets renderer plugins add structured head elements with route context', async () => {
    const renderer = await createProjectRenderer({
      config: {
        site: {
          title: 'Site',
          head: {
            elements: [{ tag: 'meta', attributes: { name: 'site', content: 'yes' } }],
          },
        },
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
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })
    const output = renderer.render('/')
    if (output.kind !== 'page') throw new Error('Expected a page output')
    expect(output.page.head).toContain('name="site"')
    expect(output.page.head).toContain('rel="canonical"')
  })

  it('registers routes against one initial manifest and inspects the immutable result', async () => {
    const inspected: string[][] = []
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
      routesResolved(context) {
        expect(Object.isFrozen(context.routes)).toBe(true)
        inspected.push(context.routes.map((route) => route.path))
      },
    })
    const second = definePlugin({
      name: 'second-routes',
      routes(context) {
        expect(context.routes.map((route) => route.path)).toEqual(['/'])
        return {
          kind: 'page',
          path: '/virtual',
          component: Page,
        }
      },
    })
    const renderer = await createProjectRenderer({
      config: {
        site: { title: 'Site' },
        plugins: [first, second],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })

    expect(renderer.paths).toEqual(['/', '/first.xml', '/virtual'])
    expect(renderer.render('/first.xml')).toEqual({
      kind: 'resource',
      status: 200,
      body: '<first />',
      contentType: 'application/xml',
    })
    expect(renderer.render('/virtual')).toMatchObject({ kind: 'page' })
    expect(inspected).toEqual([['/', '/first.xml', '/virtual']])
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
        site: { title: 'Site' },
        plugins: [duplicate('one'), duplicate('two')],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: Page } },
      islandModules: {},
    })).rejects.toThrow('Duplicate route /same.xml: one routes()[0] and two routes()[1]')
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

  it('protects nested and repeated behavior subtrees with parser-backed ownership', async () => {
    const renderer = await createProjectRenderer({
      config: {
        site: { title: 'Site' },
        plugins: [definePlugin({
          name: 'invalid-nested-behavior',
          renderer: () => ({
            transformPage: (page) => ({
              ...page,
              html: page.html.replace('>Inner</button>', '>Changed</button>'),
            }),
          }),
        })],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: BehaviorPage } },
      islandModules: {},
    })
    expect(() => renderer.render('/')).toThrow(
      'Nib plugin invalid-nested-behavior failed in transformPage() for route /',
    )
    expect(() => renderer.render('/')).toThrow('cannot change client behavior markup')
  })

  it('allows changes outside owned subtrees even when scripts contain marker-like text', async () => {
    const renderer = await createProjectRenderer({
      config: {
        site: { title: 'Site' },
        plugins: [definePlugin({
          name: 'outside-only',
          renderer: () => ({
            transformPage: (page) => ({
              ...page,
              html: `${page.html}<script>const marker = "<nib-behavior></nib-behavior>"</script>`,
            }),
          }),
        })],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: BehaviorPage } },
      islandModules: {},
    })
    const output = renderer.render('/')
    expect(output.kind).toBe('page')
  })

  it('fails closed when a renderer removes an owned closing marker', async () => {
    const renderer = await createProjectRenderer({
      config: {
        site: { title: 'Site' },
        plugins: [definePlugin({
          name: 'malformed-marker',
          renderer: () => ({
            transformPage: (page) => ({
              ...page,
              html: page.html.replace('</nib-behavior>', ''),
            }),
          }),
        })],
      },
      root: process.cwd(),
      base: '/',
      pages: { '/src/pages/page.tsx': { default: BehaviorPage } },
      islandModules: {},
    })
    expect(() => renderer.render('/')).toThrow('Malformed or implicitly closed')
  })
})
