import { createElement } from 'react'
import { loadCollections } from './content'
import { DefaultSiteShell } from './default-shell'
import { renderHead } from './meta'
import {
  renderReactPage,
  type RenderedReactPage,
} from './render-page'
import { validateIslandModules, type IslandModule } from './islands'
import { createRoutes, getRoute, type RouteLayouts } from './router'
import { stripBasePath } from './urls'
import type {
  NibConfig,
  PageModule,
  RenderedPage,
} from './types'

export interface ProjectRendererOptions {
  config: NibConfig
  root: string
  base: string
  pages: Record<string, PageModule>
  folderLayouts?: RouteLayouts['folders']
  namedLayouts?: RouteLayouts['named']
  islandModules: Record<string, IslandModule>
}

export interface ProjectRenderer {
  paths: string[]
  render(url: string): RenderedPage
}

function renderPage(
  route: ReturnType<typeof getRoute>,
  config: NibConfig,
  collections: unknown,
): RenderedReactPage {
  const pageProps = { route, site: config.site, collections } as any
  let content = createElement(route.component, {
    ...pageProps,
    ...(route.data === undefined ? {} : { data: route.data }),
  })

  for (const Layout of [...route.layouts].reverse()) {
    content = createElement(
      Layout,
      {
        ...pageProps,
        data: route.data,
        frontmatter: route.frontmatter,
      },
      content,
    )
  }

  const Shell = config.shell ?? DefaultSiteShell
  return renderReactPage(createElement(Shell, { ...pageProps, children: content }))
}

export async function createProjectRenderer(
  options: ProjectRendererOptions,
): Promise<ProjectRenderer> {
  validateIslandModules(options.islandModules)
  const collections = await loadCollections(options.config.collections, options.root)
  const layoutModules: RouteLayouts = {
    ...(options.folderLayouts === undefined ? {} : { folders: options.folderLayouts }),
    ...(options.namedLayouts === undefined ? {} : { named: options.namedLayouts }),
  }
  const routes = createRoutes(options.pages, options.config.site, layoutModules)

  return {
    paths: [...routes.values()]
      .filter((route) => route.status === 200)
      .map((route) => route.path),
    render(url) {
      const route = getRoute(routes, stripBasePath(url, options.base))
      const page = renderPage(route, options.config, collections)
      return {
        status: route.status,
        head: renderHead(route.meta),
        html: page.html,
        islands: page.islands,
      }
    },
  }
}
