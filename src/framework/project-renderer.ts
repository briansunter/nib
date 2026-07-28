import { createElement, type ReactNode } from 'react'
import { loadCollections } from './content-server'
import { DefaultSiteShell } from './default-shell'
import { renderHead } from './meta'
import { deepFreeze } from './freeze'
import { createContentRenderer } from './markdown-content'
import { renderReactPage } from './render-page'
import { validateIslandModules, type IslandModule } from './islands'
import { behaviorFileToId } from './behavior-paths'
import { resolvedRouteSnapshot } from './snapshots'
import {
  addConfiguredRedirects,
  addPluginRoutes,
  createRoutes,
  getRoute,
  type RouteLayouts,
} from './router'
import {
  canonicalRequestRedirect,
  normalizePath,
  publicRouteHref,
  stripBasePath,
} from './publication'
import {
  createRendererPluginPipeline,
  resolvedRouteSnapshots,
  resolvePluginRouteContribution,
  type NibFinalizeContext,
  type NibRenderPageContext,
  type NibCommand,
} from './plugin'
import type {
  CollectionEntry,
  NibConfig,
  PageModule,
  PageSourceDefinition,
  RenderedOutput,
  ResolvedPageRoute,
  ResolvedRoute,
  SiteShellProps,
  PageDescriptor,
  CollectionCapability,
  PageRoute,
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
  behaviorClientFiles?: readonly string[]
}

function behaviorClientIds(files: readonly string[]): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const file of files) {
    const id = behaviorFileToId(file)
    if (ids.has(id)) throw new Error(`Duplicate behavior ID: ${id}`)
    ids.add(id)
  }
  return ids
}

function assertClientModules(
  route: ResolvedPageRoute,
  kind: 'island' | 'behavior',
  emittedIds: readonly string[],
  discoveredIds: { has(id: string): boolean },
): void {
  const missing = emittedIds.filter((id) => !discoveredIds.has(id))
  if (missing.length === 0) return
  const marker = missing.length === 1
    ? `${kind} "${missing[0]}"`
    : `${kind}s ${missing.map((id) => `"${id}"`).join(', ')}`
  const pattern = kind === 'island'
    ? 'src/islands/**/*.tsx'
    : 'src/behaviors/**/*.client.{ts,tsx}'
  throw new Error(
    `Route ${route.path} emitted ${marker} without a matching client module in ${pattern}`,
  )
}

function pageSourceCollectionEntries(
  modules: Record<string, PageModule>,
): ReadonlyMap<PageSourceDefinition<any>, readonly CollectionEntry[]> {
  const entries = new Map<PageSourceDefinition<any>, CollectionEntry[]>()
  for (const module of Object.values(modules)) {
    for (const page of module.pages ?? []) {
      if (
        page.meta?.draft === true
        || !page.sourceDefinition
        || page.collectionId === undefined
      ) continue
      const collection = entries.get(page.sourceDefinition) ?? []
      collection.push({ id: page.collectionId, data: page.data })
      entries.set(page.sourceDefinition, collection)
    }
  }
  return entries
}

function pageDescriptors(routes: Iterable<ResolvedRoute>): readonly PageDescriptor[] {
  return Object.freeze(
    [...routes]
      .filter((route): route is ResolvedPageRoute => route.kind === 'page')
      .sort((left, right) => left.path.localeCompare(right.path) || left.source.localeCompare(right.source))
      .map((route) => Object.freeze({
        path: route.path,
        source: route.source,
        meta: deepFreeze({ ...route.meta }),
        frontmatter: deepFreeze(route.frontmatter),
        data: deepFreeze(route.data),
      })),
  )
}

export interface ProjectRenderer {
  readonly paths: readonly string[]
  render(url: string): RenderedOutput
  finalize(context: Pick<NibFinalizeContext, 'clientDirectory' | 'publication'>): Promise<void>
}

function composePage(
  route: ResolvedPageRoute,
  publicRoute: PageRoute,
  shell: NibConfig['shell'],
  collections: unknown,
): ReactNode {
  const Content = route.content === undefined
    ? undefined
    : createContentRenderer(route.content)
  const pageProps = { route: publicRoute, collections, Content }
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

  const Shell = shell ?? DefaultSiteShell
  // The config is loaded dynamically at runtime, so its concrete collection
  // map is unavailable to this erased React module. Authoring helpers retain
  // the concrete type for consumers; this is the single runtime handoff.
  return createElement(Shell, { ...pageProps, children: content } as SiteShellProps<any>)
}

function publicRedirectDestination(base: string, destination: string): string {
  if (!destination.startsWith('/') || destination.startsWith('//')) return destination
  const parsed = new URL(destination, 'http://nib.local')
  return `${publicRouteHref(base, parsed.pathname)}${parsed.search}${parsed.hash}`
}

export async function createProjectRenderer(
  options: ProjectRendererOptions,
): Promise<ProjectRenderer> {
  const islandDefinitions = validateIslandModules(options.islandModules)
  const behaviorIds = behaviorClientIds(options.behaviorClientFiles ?? [])
  const layoutModules: RouteLayouts = {
    ...(options.folderLayouts === undefined ? {} : { folders: options.folderLayouts }),
    ...(options.namedLayouts === undefined ? {} : { named: options.namedLayouts }),
  }
  const rendererContext = Object.freeze({
    command: options.command ?? 'build',
    mode: options.command === 'serve' ? 'development' as const : 'production' as const,
    root: options.root,
    base: options.base,
    ...(options.config.origin === undefined ? {} : { origin: options.config.origin }),
  })
  const configuredPlugins = options.config.plugins ?? []
  const routes: Map<string, ResolvedRoute> = new Map(createRoutes(
    options.pages,
    layoutModules,
    options.config.trailingSlash,
  ))
  const collections = await loadCollections(
    options.config.collections,
    options.root,
    pageSourceCollectionEntries(options.pages),
    pageDescriptors(routes.values()),
  )
  const collectionDefinitions = new Map<object, string>()
  for (const [name, definition] of Object.entries(options.config.collections ?? {})) {
    const priorName = collectionDefinitions.get(definition)
    if (priorName !== undefined) {
      throw new Error(
        `Collection definition is registered as both ${priorName} and ${name}; `
        + 'each capability collection must have one configuration identity',
      )
    }
    collectionDefinitions.set(definition, name)
  }
  const readCollection = <Result>(capability: CollectionCapability<Result>): Result => {
    if (
      capability?.kind !== 'collection-capability'
      || typeof capability.map !== 'function'
    ) {
      throw new Error('Invalid Nib collection capability')
    }
    const name = collectionDefinitions.get(capability.collection)
    if (name === undefined) {
      throw new Error('Collection capability references a collection not registered by this site')
    }
    const entries = (collections as Record<string, readonly CollectionEntry[]>)[name] ?? []
    return deepFreeze(capability.map(entries))
  }
  addConfiguredRedirects(
    routes,
    options.config.redirects,
    options.config.trailingSlash,
  )
  const routeContext = Object.freeze({ ...rendererContext, readCollection })
  for (const plugin of configuredPlugins) {
    const contributedRoutes = await resolvePluginRouteContribution(
      plugin,
      routeContext,
      resolvedRouteSnapshots(routes.values()),
    )
    addPluginRoutes(
      routes,
      contributedRoutes,
      options.config.trailingSlash,
    )
  }
  const resolvedRoutes = resolvedRouteSnapshots(routes.values())
  const routeSnapshots = new Map(resolvedRoutes.map((route) => [route.path, route]))
  const plugins = await createRendererPluginPipeline(configuredPlugins, rendererContext)
  let finalized = false

  return {
    paths: [...routes.values()]
      .filter((route) => normalizePath(route.path) !== '/404')
      .map((route) => route.path),
    render(url) {
      if (finalized) throw new Error('Nib project renderer cannot render after finalization')
      const route = getRoute(routes, stripBasePath(url, options.base))
      const slashRedirect = route.source === 'generated' || normalizePath(route.path) === '/404'
        ? undefined
        : canonicalRequestRedirect(
            url,
            options.base,
            route.path,
            options.config.trailingSlash,
          )
      if (slashRedirect !== undefined) {
        return {
          kind: 'redirect',
          status: 301,
          destination: slashRedirect,
        }
      }
      if (route.kind === 'resource') {
        return {
          kind: 'resource',
          status: route.status,
          body: route.body,
          contentType: route.contentType,
        }
      }
      if (route.kind === 'redirect') {
        return {
          kind: 'redirect',
          status: route.status,
          destination: publicRedirectDestination(options.base, route.destination),
        }
      }
      const knownRoute = routeSnapshots.get(route.path)
      const publicRoute = knownRoute?.kind === 'page'
        ? knownRoute
        : resolvedRouteSnapshot(route)
      if (knownRoute === undefined) routeSnapshots.set(publicRoute.path, publicRoute)
      const pageContext: NibRenderPageContext = Object.freeze({
        command: options.command ?? 'build',
        route: publicRoute,
        root: options.root,
        base: options.base,
        ...(options.config.origin === undefined ? {} : { origin: options.config.origin }),
        mode: options.command === 'serve' ? 'development' : 'production',
      })
      const head = plugins.head(pageContext)
      const content = plugins.wrapPage(composePage(
        route,
        publicRoute,
        options.config.shell,
        collections,
      ), pageContext)
      const reactPage = renderReactPage(
        content,
        route.content === undefined ? [] : [route.content],
      )
      assertClientModules(route, 'island', reactPage.islands, islandDefinitions)
      assertClientModules(route, 'behavior', reactPage.behaviors, behaviorIds)
      return {
        kind: 'page',
        page: {
          status: route.status,
          head: renderHead(publicRoute.meta, head),
          html: reactPage.html,
          islands: reactPage.islands,
          behaviors: reactPage.behaviors,
        },
      }
    },
    async finalize(context) {
      if (finalized) throw new Error('Nib project renderer can only finalize once')
      finalized = true
      const finalContext: NibFinalizeContext = Object.freeze({
        ...rendererContext,
        clientDirectory: context.clientDirectory,
        publication: deepFreeze(context.publication),
      })
      await plugins.finalize(finalContext)
    },
  }
}
