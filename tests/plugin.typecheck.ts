import { defineConfig } from '../src/index'
import { definePlugin } from '../src/plugin'

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

// @ts-expect-error renderer hooks must be functions.
definePlugin({ name: 'bad-renderer', renderer: true })
// @ts-expect-error a Vite contribution must be a Vite PluginOption.
definePlugin({ name: 'bad-vite', vite: () => 42 })
