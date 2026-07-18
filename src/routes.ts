import site from './site.config'
import { discoverPages } from './framework/discover'
import { createRoutes } from './framework/router'

export const routes = createRoutes(discoverPages(), site)
export const paths = [...routes.values()]
  .filter((route) => route.status === 200)
  .map((route) => route.path)
