import { renderToString } from 'react-dom/server'
import { App } from './App'
import site from './site.config'
import { renderHead } from './framework/meta'
import { getRoute } from './framework/router'
import type { RenderedPage } from './framework/types'
import { routes } from './routes'

export const paths = [...routes.values()]
  .filter((route) => route.status === 200)
  .map((route) => route.path)

export function render(url: string): RenderedPage {
  const route = getRoute(routes, url)
  return {
    status: route.status,
    head: renderHead(route.meta),
    html: renderToString(<App route={route} site={site} />)
  }
}
