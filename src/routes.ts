import site from './site.config'
import { createRoutes } from './framework/router'
import type { PageModule } from './framework/types'

const pages = import.meta.glob<PageModule>(
  ['./pages/**/page.tsx', './pages/**/page.md'],
  { eager: true },
)

export const routes = createRoutes(pages, site)
