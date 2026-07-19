import {
  definePageSource,
  type DataPageProps,
  z,
} from '@briansunter/nib'
import { definePlugin } from '@briansunter/nib/plugin'
import { parse as parseToml } from 'smol-toml'

const settingsSchema = z.object({
  heading: z.string(),
  enabled: z.boolean(),
})

function SettingsPage({
  data,
}: DataPageProps<z.infer<typeof settingsSchema>>) {
  return <h1>{data.heading}: {data.enabled ? 'enabled' : 'disabled'}</h1>
}

function VirtualPage() {
  return <h1>Plugin virtual page</h1>
}

export function tomlPages() {
  return definePlugin({
    name: 'test-toml-pages',
    setup() {
      return {
        pageSources: [
          definePageSource({
            extensions: ['toml'],
            schema: settingsSchema,
            load: ({ source }) => ({ data: parseToml(source) }),
            component: SettingsPage,
          }),
        ],
      }
    },
  })
}

export function virtualRoutes() {
  return definePlugin({
    name: 'test-virtual-routes',
    routes(context) {
      if (!Object.isFrozen(context.routes)) {
        throw new Error('Initial routes must be immutable')
      }
      return [
        {
          kind: 'page',
          path: '/virtual',
          component: VirtualPage,
          meta: { title: 'Virtual' },
        },
        {
          kind: 'resource',
          path: '/rss.xml',
          contentType: 'application/rss+xml; charset=utf-8',
          body: '<?xml version="1.0"?><rss version="2.0"><channel><title>Journal</title></channel></rss>',
        },
      ] as const
    },
    routesResolved(context) {
      if (!Object.isFrozen(context.routes)) {
        throw new Error('Resolved routes must be immutable')
      }
      for (const path of ['/legacy/', '/virtual/', '/sitemap.xml', '/rss.xml']) {
        if (!context.routes.some((route) => route.path === path)) {
          throw new Error(`Missing resolved route ${path}`)
        }
      }
    },
  })
}
