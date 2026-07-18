import { App } from './App'
import site from './site.config'
import { renderHead } from './framework/meta'
import { getRoute } from './framework/router'
import type { RenderedPage } from './framework/types'
import { renderReactPage } from './framework/render-page'
import { stripBasePath } from './framework/urls'
import { validateIslandModules, type IslandModule } from './framework/islands'
import { routes } from './routes'

const islandModules = import.meta.glob<IslandModule>('./islands/**/*.tsx', { eager: true })
validateIslandModules(islandModules)

export const paths = [...routes.values()]
  .filter((route) => route.status === 200)
  .map((route) => route.path)

export function render(url: string): RenderedPage {
  const route = getRoute(routes, stripBasePath(url, import.meta.env.BASE_URL))
  const page = renderReactPage(<App route={route} site={site} />)
  return {
    status: route.status,
    head: renderHead(route.meta),
    html: page.html,
    islands: page.islands,
  }
}
