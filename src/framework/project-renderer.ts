import { createElement, type ReactNode } from 'react'
import { loadCollections } from './content'
import { DefaultSiteShell } from './default-shell'
import { renderHead } from './meta'
import { renderReactPage } from './render-page'
import { validateIslandModules, type IslandModule } from './islands'
import { createRoutes, getRoute, type RouteLayouts } from './router'
import { stripBasePath } from './urls'
import {
  createRendererPluginPipeline,
  type NibFinalizeContext,
  type NibRenderPageContext,
  type NibCommand,
} from './plugin'
import type {
  NibConfig,
  PageModule,
  RenderedPage,
} from './types'

export interface ProjectRendererOptions {
  config: NibConfig
  root: string
  base: string
  command?: NibCommand
  pages: Record<string, PageModule>
  folderLayouts?: RouteLayouts['folders']
  namedLayouts?: RouteLayouts['named']
  islandModules: Record<string, IslandModule>
}

export interface ProjectRenderer {
  readonly paths: readonly string[]
  render(url: string): RenderedPage
  finalize(context: Pick<NibFinalizeContext, 'clientDirectory'>): Promise<void>
}

function readonlySite(config: NibConfig): NibFinalizeContext['site'] {
  return Object.freeze({
    ...config.site,
    ...(config.site.navigation === undefined
      ? {}
      : {
          navigation: Object.freeze(
            config.site.navigation.map((item) => Object.freeze({ ...item })),
          ),
        }),
  })
}

function composePage(
  route: ReturnType<typeof getRoute>,
  config: NibConfig,
  collections: unknown,
): ReactNode {
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
  return createElement(Shell, { ...pageProps, children: content })
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
  const rendererContext = Object.freeze({
    command: options.command ?? 'build',
    mode: options.command === 'serve' ? 'development' as const : 'production' as const,
    root: options.root,
    base: options.base,
    site: readonlySite(options.config),
  })
  const plugins = await createRendererPluginPipeline(options.config.plugins ?? [], rendererContext)
  const renderedPaths = new Set<string>()
  let finalized = false

  return {
    paths: [...routes.values()]
      .filter((route) => route.status === 200)
      .map((route) => route.path),
    render(url) {
      if (finalized) throw new Error('Nib project renderer cannot render after finalization')
      const route = getRoute(routes, stripBasePath(url, options.base))
      const pageContext: NibRenderPageContext = Object.freeze({
        command: options.command ?? 'build',
        route: Object.freeze({
          path: route.path,
          source: route.source,
          status: route.status,
          meta: Object.freeze({ ...route.meta }),
        }),
        root: options.root,
        base: options.base,
        mode: options.command === 'serve' ? 'development' : 'production',
      })
      const content = plugins.wrapPage(composePage(route, options.config, collections), pageContext)
      const reactPage = renderReactPage(content)
      const renderedPage = plugins.transformPage({
        status: route.status,
        head: renderHead(route.meta),
        html: reactPage.html,
      }, pageContext)
      renderedPaths.add(route.path)
      return { ...renderedPage, islands: reactPage.islands }
    },
    async finalize(context) {
      if (finalized) throw new Error('Nib project renderer can only finalize once')
      finalized = true
      const finalContext: NibFinalizeContext = Object.freeze({
        ...rendererContext,
        clientDirectory: context.clientDirectory,
        renderedPaths: Object.freeze([...renderedPaths]),
      })
      await plugins.finalize(finalContext)
    },
  }
}
