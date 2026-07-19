import { createElement, type ReactNode } from 'react'
import { loadCollections } from './content'
import { DefaultSiteShell } from './default-shell'
import { renderHead } from './meta'
import { renderReactPage } from './render-page'
import { validateIslandModules, type IslandModule } from './islands'
import {
  addConfiguredRedirects,
  addPluginRoutes,
  createRoutes,
  getRoute,
  type RouteLayouts,
} from './router'
import { stripBasePath } from './urls'
import {
  createRendererPluginPipeline,
  inspectResolvedPluginRoutes,
  resolvedRouteSnapshots,
  resolvePluginRouteContributions,
  type NibFinalizeContext,
  type NibRenderPageContext,
  type NibCommand,
} from './plugin'
import type {
  NibConfig,
  PageModule,
  RenderedOutput,
  ResolvedPageRoute,
  ResolvedRoute,
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
  render(url: string): RenderedOutput
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
  route: ResolvedPageRoute,
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

function routeHref(base: string, routePath: string): string {
  if (routePath === '/') return base
  return `${base}${routePath.replace(/^\/+/, '')}`
}

function publicRedirectDestination(base: string, destination: string): string {
  if (!destination.startsWith('/') || destination.startsWith('//')) return destination
  const parsed = new URL(destination, 'http://nib.local')
  return `${routeHref(base, parsed.pathname)}${parsed.search}${parsed.hash}`
}

function canonicalRequestRedirect(
  url: string,
  base: string,
  routePath: string,
  policy: NibConfig['trailingSlash'],
): string | undefined {
  if (policy === undefined || policy === 'ignore' || routePath === '/') return undefined
  const stripped = stripBasePath(url, base)
  const parsed = new URL(stripped, 'http://nib.local')
  if (parsed.pathname === routePath) return undefined
  return `${routeHref(base, routePath)}${parsed.search}${parsed.hash}`
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
  const rendererContext = Object.freeze({
    command: options.command ?? 'build',
    mode: options.command === 'serve' ? 'development' as const : 'production' as const,
    root: options.root,
    base: options.base,
    site: readonlySite(options.config),
  })
  const configuredPlugins = options.config.plugins ?? []
  const routes: Map<string, ResolvedRoute> = new Map(createRoutes(
    options.pages,
    options.config.site,
    layoutModules,
    options.config.trailingSlash,
  ))
  addConfiguredRedirects(
    routes,
    options.config.redirects,
    options.config.trailingSlash,
  )
  const initialRoutes = resolvedRouteSnapshots(routes.values())
  const contributedRoutes = await resolvePluginRouteContributions(
    configuredPlugins,
    rendererContext,
    initialRoutes,
  )
  addPluginRoutes(
    routes,
    contributedRoutes,
    options.config.site,
    options.config.trailingSlash,
  )
  const resolvedRoutes = resolvedRouteSnapshots(routes.values())
  await inspectResolvedPluginRoutes(configuredPlugins, rendererContext, resolvedRoutes)
  const plugins = await createRendererPluginPipeline(configuredPlugins, rendererContext)
  const renderedPaths = new Set<string>()
  let finalized = false

  return {
    paths: [...routes.values()]
      .filter((route) => route.status !== 404)
      .map((route) => route.path),
    render(url) {
      if (finalized) throw new Error('Nib project renderer cannot render after finalization')
      const route = getRoute(routes, stripBasePath(url, options.base))
      const slashRedirect = route.source === 'generated' || route.status === 404
        ? undefined
        : canonicalRequestRedirect(
            url,
            options.base,
            route.path,
            options.config.trailingSlash,
          )
      if (slashRedirect !== undefined) {
        renderedPaths.add(route.path)
        return {
          kind: 'redirect',
          status: 301,
          destination: slashRedirect,
        }
      }
      if (route.kind === 'resource') {
        renderedPaths.add(route.path)
        return {
          kind: 'resource',
          status: route.status,
          body: route.body,
          contentType: route.contentType,
        }
      }
      if (route.kind === 'redirect') {
        renderedPaths.add(route.path)
        return {
          kind: 'redirect',
          status: route.status,
          destination: publicRedirectDestination(options.base, route.destination),
        }
      }
      const pageContext: NibRenderPageContext = Object.freeze({
        command: options.command ?? 'build',
        route: Object.freeze({
          kind: 'page',
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
      return {
        kind: 'page',
        page: { ...renderedPage, islands: reactPage.islands },
      }
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
