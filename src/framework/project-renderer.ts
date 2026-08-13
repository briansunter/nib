import { createElement, type ComponentType, type ReactNode } from 'react'
import path from 'node:path'
import { loadCollections } from './content-server'
import { createBuildCache } from './cache'
import { createBuildOutputSession } from './build-output'
import { DefaultSiteShell } from './default-shell'
import { renderHead, resolveMeta } from './meta'
import { deepFreeze } from './freeze'
import { createContentRenderer } from './markdown-content'
import { renderReactPage, type RenderedReactPage } from './render-page'
import {
  ENHANCEMENT_MODULE_GLOB,
  enhancementFileToId,
} from './enhancement-paths'
import {
  ISLAND_MODULE_GLOB,
} from './island-paths'
import {
  validateIslandModules,
  type IslandModule,
} from './islands'
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
import { normalizeRoutePath } from './paths'
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
  DerivedPagesDefinition,
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
  enhancementClientFiles?: readonly string[]
  islandModules?: Record<string, IslandModule>
  derivedPages?: {
    definitions: readonly DerivedPagesDefinition<any>[]
    components: readonly (ComponentType<any> | undefined)[]
  }
}

const derivedRendererLoads = new WeakMap<object, Promise<ComponentType<any>>>()

async function resolveDerivedComponent(
  definition: DerivedPagesDefinition<any>,
  imported: ComponentType<any> | undefined,
  label: string,
): Promise<ComponentType<any>> {
  if (imported !== undefined) return imported
  const component = definition.component
  if (typeof component === 'function') return component
  const renderer = component as { load?: () => Promise<unknown> }
  if (typeof renderer.load !== 'function') {
    throw new Error(`${label} derived page renderer module must be imported through Nib's Vite derived-pages module`)
  }
  const cached = derivedRendererLoads.get(renderer)
  if (cached !== undefined) return cached
  const load = renderer.load().then((loaded): ComponentType<any> => {
    const resolved = typeof loaded === 'function'
      ? (loaded as ComponentType<any>)
      : (loaded as { default?: ComponentType<any> })?.default
    if (typeof resolved !== 'function') throw new Error(`${label} derived page renderer must resolve to a React component`)
    return resolved
  })
  derivedRendererLoads.set(renderer, load)
  return load
}

function enhancementClientIds(files: readonly string[]): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const file of files) {
    const id = enhancementFileToId(file)
    if (ids.has(id)) throw new Error(`Duplicate enhancement ID: ${id}`)
    ids.add(id)
  }
  return ids
}

function assertEnhancementModules(
  route: ResolvedPageRoute,
  emittedIds: readonly string[],
  discoveredIds: { has(id: string): boolean },
): void {
  const missing = emittedIds.filter((id) => !discoveredIds.has(id))
  if (missing.length === 0) return
  const marker = missing.length === 1
    ? `enhancement "${missing[0]}"`
    : `enhancements ${missing.map((id) => `"${id}"`).join(', ')}`
  throw new Error(
    `Route ${route.path} emitted ${marker} without a matching client module in ${ENHANCEMENT_MODULE_GLOB.slice(1)}`,
  )
}

function assertIslandModules(
  route: ResolvedPageRoute,
  emittedIds: readonly string[],
  discoveredIds: { has(id: string): boolean },
): void {
  const missing = emittedIds.filter((id) => !discoveredIds.has(id))
  if (missing.length === 0) return
  const marker = missing.length === 1
    ? `island "${missing[0]}"`
    : `islands ${missing.map((id) => `"${id}"`).join(', ')}`
  throw new Error(
    `Route ${route.path} emitted ${marker} without a matching module in ${ISLAND_MODULE_GLOB[0].slice(1)}`,
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
  const enhancementIds = enhancementClientIds(options.enhancementClientFiles ?? [])
  const islandDefinitions = validateIslandModules(options.islandModules ?? {})
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
  if (options.derivedPages !== undefined && options.derivedPages.definitions.length > 0) {
    const named = layoutModules.named ?? {}
    for (const [index, definition] of options.derivedPages.definitions.entries()) {
      const label = `Derived pages[${index}]`
      const component = await resolveDerivedComponent(
        definition,
        options.derivedPages.components[index],
        label,
      )
      const pageSpecs = readCollection(definition.pages)
      const seen = new Set<string>()
      for (const [pageIndex, page] of pageSpecs.entries()) {
        const path = normalizeRoutePath(
          page.path,
          `${label}[${pageIndex}] path`,
          options.config.trailingSlash,
        )
        const key = normalizePath(path)
        if (seen.has(key)) throw new Error(`${label} produced duplicate route ${path}`)
        if (routes.has(key)) {
          throw new Error(`Duplicate route ${path}: ${routes.get(key)?.source} and ${label}[${pageIndex}]`)
        }
        seen.add(key)
        const meta = resolveMeta(page.meta, `${label}[${pageIndex}] metadata`)
        if (meta.draft === true) continue
        const layouts: ComponentType<any>[] = []
        const layoutName = page.layout ?? definition.layout
        if (layoutName !== undefined) {
          const layoutModule = (named as Record<string, { default?: ComponentType<any> }>)[layoutName]
          if (layoutModule === undefined || typeof layoutModule.default !== 'function') {
            throw new Error(`${label} references unknown layout ${layoutName}`)
          }
          layouts.push(layoutModule.default)
        }
        routes.set(key, Object.freeze({
          kind: 'page',
          path,
          component,
          meta,
          source: `${label}[${pageIndex}]`,
          status: normalizePath(path) === '/404' ? 404 : 200,
          data: deepFreeze(page.data),
          layouts,
        }))
      }
    }
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
        ...(route.frontmatter === undefined ? {} : { frontmatter: deepFreeze(route.frontmatter) }),
        ...(route.data === undefined ? {} : { data: deepFreeze(route.data) }),
      })
      const head = plugins.head(pageContext)
      const content = plugins.wrapPage(composePage(
        route,
        publicRoute,
        options.config.shell,
        collections,
      ), pageContext)
      const reactPage: RenderedReactPage = renderReactPage(
        content,
        route.content === undefined ? [] : [route.content],
      )
      assertEnhancementModules(
        route,
        reactPage.enhancements.map(({ id }) => id),
        enhancementIds,
      )
      assertIslandModules(
        route,
        reactPage.islands.map(({ id }) => id),
        islandDefinitions,
      )
      return {
        kind: 'page',
        page: {
          status: route.status,
          head: renderHead(publicRoute.meta, head),
          html: reactPage.html,
          enhancements: reactPage.enhancements,
          islands: reactPage.islands,
        },
      }
    },
    async finalize(context) {
      if (finalized) throw new Error('Nib project renderer can only finalize once')
      finalized = true
      const outputSession = createBuildOutputSession(
        context.clientDirectory,
        context.publication,
      )
      // The context is shallow-frozen; the cache (like output) is not passed
      // through deepFreeze, so its methods remain callable across finalizers.
      const finalContext: NibFinalizeContext = Object.freeze({
        ...rendererContext,
        clientDirectory: context.clientDirectory,
        publication: deepFreeze(context.publication),
        readCollection,
        output: outputSession.output,
        cache: createBuildCache(path.join(options.root, '.nib', 'cache')),
      })
      try {
        await plugins.finalize(finalContext)
        await outputSession.complete()
      } catch (error) {
        try {
          await outputSession.abort()
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            'Nib project finalization failed and staged output cleanup also failed',
          )
        }
        throw error
      }
    },
  }
}
