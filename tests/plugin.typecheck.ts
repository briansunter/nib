import { defineConfig } from '../src/index'
import { definePlugin } from '../src/plugin'
import * as nibAuthoring from '../src/index'

// @ts-expect-error plugin authoring is isolated to the /plugin entry.
nibAuthoring.definePlugin

const plugin = definePlugin({
  name: 'typed-plugin',
  vite(context) {
    context.base
    const target: 'client' | 'server' | 'development' = context.target
    void target
    return { name: 'typed-vite-plugin' }
  },
  renderer(context) {
    context.site.title
    return {
      wrapPage(page, render) {
        render.route.path
        // @ts-expect-error plugin route facts do not expose the page implementation.
        render.route.component
        return page
      },
      transformPage(page) {
        // @ts-expect-error transform inputs are readonly.
        page.html = 'mutated'
        return page
      },
      async finalize(context) {
        context.clientDirectory
      },
    }
  },
})

const config = defineConfig({ site: { title: 'Typed' }, plugins: [plugin] as const })
const tuple: readonly [typeof plugin] = config.plugins!
void tuple

defineConfig({
  site: { title: 'Typed app Vite' },
  vite(context) {
    const target: 'client' | 'server' | 'development' = context.target
    void target
    return { name: 'typed-app-vite-plugin' }
  },
})

defineConfig({
  site: { title: 'Invalid app Vite' },
  // @ts-expect-error app Vite contributions must be factories.
  vite: true,
})

// @ts-expect-error renderer hooks must be functions.
definePlugin({ name: 'bad-renderer', renderer: true })
// @ts-expect-error a Vite contribution must be a Vite PluginOption.
definePlugin({ name: 'bad-vite', vite: () => 42 })
