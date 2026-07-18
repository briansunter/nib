import { renderToString } from 'react-dom/server'
import { App } from '../App'
import site from '../site.config'
import { renderHead } from './meta'
import { getRoute } from './router'
import type { RenderedPage, ResolvedRoute } from './types'

export function renderPage(routes: Map<string, ResolvedRoute>, url: string): RenderedPage {
  const route = getRoute(routes, url)
  return {
    status: route.status,
    head: renderHead(route.meta),
    html: renderToString(<App route={route} site={site} />)
  }
}
