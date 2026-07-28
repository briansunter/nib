import { defineConfig } from '../src/index'
import { definePlugin } from '../src/plugin'
import * as nibAuthoring from '../src/index'

// @ts-expect-error plugin authoring is isolated to the /plugin entry.
nibAuthoring.definePlugin

const plugin = definePlugin({
  name: 'typed-plugin',
  pageSources: [],
  clientEntries: [{ module: 'browser-module', initializer: 'startBrowser' }],
  vite(context) {
    context.base
    const target: 'client' | 'server' | 'development' = context.target
    void target
    return { name: 'typed-vite-plugin' }
  },
  routes(context) {
    const first = context.routes[0]
    if (first?.kind === 'resource') first.contentType
    // @ts-expect-error resolved routes do not expose page implementations.
    first?.component
    return {
      kind: 'resource',
      path: '/feed.xml',
      body: '<feed />',
      contentType: 'application/xml',
    }
  },
  renderer(context) {
    context.origin
    return {
      head(render) {
        render.route.path
        return {
          elements: [{
            tag: 'meta',
            attributes: { name: 'test', content: 'yes' },
          }],
        }
      },
      wrapPage(page, render) {
        render.route.path
        // @ts-expect-error plugin route facts do not expose the page implementation.
        render.route.component
        return page
      },
      async finalize(context) {
        context.clientDirectory
        context.publication.routes
        // @ts-expect-error publication data is immutable.
        context.publication.routes.push()
      },
    }
  },
})

const config = defineConfig({ plugins: [plugin] as const })
const tuple: readonly [typeof plugin] = config.plugins!
void tuple

defineConfig({
  origin: 'https://typed.example',
  trailingSlash: 'always',
  redirects: {
    '/old': { destination: '/new', status: 308 },
  },
  vite(context) {
    const target: 'client' | 'server' | 'development' = context.target
    void target
    return { name: 'typed-app-vite-plugin' }
  },
})

defineConfig({
  // @ts-expect-error app Vite contributions must be factories.
  vite: true,
})

defineConfig({
  // @ts-expect-error configuration keys are closed and typo-safe.
  orgin: 'https://typo.example',
})

// @ts-expect-error renderer hooks must be functions.
definePlugin({ name: 'bad-renderer', renderer: true })
// @ts-expect-error declarative page sources must be an array.
definePlugin({ name: 'bad-page-sources', pageSources: true })
// @ts-expect-error declarative client entries must have valid fields.
definePlugin({ name: 'bad-client-entry', clientEntries: [{ module: 1, initializer: 'start' }] })
// @ts-expect-error a Vite contribution must be a Vite PluginOption.
definePlugin({ name: 'bad-vite', vite: () => 42 })
// @ts-expect-error route registrations use a closed discriminated union.
definePlugin({ name: 'bad-route', routes: () => ({ kind: 'unknown', path: '/' }) })
