import { createElement, type ReactNode } from 'react'
import { loadCollections } from './content'
import { DefaultSiteShell } from './default-shell'
import { renderHead } from './meta'
import { renderReactPage } from './render-page'
import { validateIslandModules, type IslandModule } from './islands'
import { createRoutes, getRoute, type RouteLayouts } from './router'
import { stripBasePath } from './urls'
import {
  pluginError,
  validateRenderedPage,
  validateRendererExtension,
  type NibFinalizeContext,
  type NibRenderPageContext,
  type NibRendererExtension,
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
  paths: string[]
  render(url: string): RenderedPage
  finalize(context: NibFinalizeContext): Promise<void>
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
    site: options.config.site,
  })
  const extensions: Array<{ plugin: NonNullable<NibConfig['plugins']>[number]; extension: NibRendererExtension }> = []
  for (const plugin of options.config.plugins ?? []) {
    if (!plugin.renderer) continue
    try {
      const extension = await plugin.renderer(rendererContext)
      if (extension !== undefined) extensions.push({
        plugin,
        extension: validateRendererExtension(extension, plugin),
      })
    } catch (error) {
      throw pluginError(plugin, 'renderer()', error)
    }
  }
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
        route,
        root: options.root,
        base: options.base,
        mode: options.command === 'serve' ? 'development' : 'production',
      })
      let content = composePage(route, options.config, collections)
      for (const { plugin, extension } of [...extensions].reverse()) {
        if (!extension.wrapPage) continue
        try {
          content = extension.wrapPage(content, pageContext)
        } catch (error) {
          throw pluginError(plugin, 'wrapPage()', error, route.path)
        }
      }
      const reactPage = renderReactPage(content)
      let renderedPage: RenderedPage = {
        status: route.status,
        head: renderHead(route.meta),
        html: reactPage.html,
        islands: reactPage.islands,
      }
      for (const { plugin, extension } of extensions) {
        if (!extension.transformPage) continue
        try {
          renderedPage = validateRenderedPage(
            extension.transformPage(renderedPage, pageContext),
            plugin,
          )
        } catch (error) {
          throw pluginError(plugin, 'transformPage()', error, route.path)
        }
      }
      renderedPaths.add(route.path)
      return renderedPage
    },
    async finalize(context) {
      if (finalized) throw new Error('Nib project renderer can only finalize once')
      finalized = true
      const finalContext: NibFinalizeContext = Object.freeze({
        ...context,
        root: options.root,
        base: options.base,
        renderedPaths: [...renderedPaths],
      })
      for (const { plugin, extension } of extensions) {
        if (!extension.finalize) continue
        try {
          await extension.finalize(finalContext)
        } catch (error) {
          throw pluginError(plugin, 'finalize()', error)
        }
      }
    },
  }
}
