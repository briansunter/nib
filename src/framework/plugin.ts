import type { ComponentType, ReactNode } from 'react'
import type { Plugin, PluginOption } from 'vite'
import type {
  PageMeta,
  PageSourceDefinition,
  DataValidator,
  RedirectStatus,
  RenderedPage,
  ResolvedPageRoute,
  ResolvedRoute,
  SiteConfig,
} from './types'

export type NibCommand = 'build' | 'serve'
export type NibMode = 'development' | 'production'
export type NibViteTarget = 'client' | 'server' | 'development'
export type Awaitable<Value> = Value | Promise<Value>

export type NibPluginSiteConfig = Readonly<
  Omit<SiteConfig, 'navigation'>
  & {
    readonly navigation?: readonly Readonly<NonNullable<SiteConfig['navigation']>[number]>[]
  }
>

/** Stable route facts available to renderer plugins. Framework implementation
 * details such as the page module, layouts, and page data remain private. */
export interface NibPluginRoute {
  readonly kind: 'page'
  readonly path: string
  readonly source: string
  readonly status: number
  readonly meta: Readonly<ResolvedPageRoute['meta']>
}

/** A plugin may alter static output, but hydration ownership remains with Nib. */
export type NibRenderedPage = Readonly<Omit<RenderedPage, 'islands'>>

export interface NibVitePluginContext {
  readonly command: NibCommand
  readonly mode: NibMode
  /** The Vite graph receiving this fresh plugin instance. */
  readonly target: NibViteTarget
  readonly root: string
  readonly base: string
  readonly configPath: string
}

export interface NibRendererPluginContext {
  readonly command: NibCommand
  readonly mode: NibMode
  readonly root: string
  readonly base: string
  readonly site: NibPluginSiteConfig
}

export interface NibRenderPageContext {
  readonly command: NibCommand
  readonly route: NibPluginRoute
  readonly root: string
  readonly base: string
  readonly mode: NibMode
}

export interface NibFinalizeContext extends NibRendererPluginContext {
  readonly clientDirectory: string
  readonly renderedPaths: readonly string[]
}

export interface NibPluginSetupResult {
  readonly pageSources?: readonly PageSourceDefinition<DataValidator<any>>[]
}

export interface NibResolvedPageRoute {
  readonly kind: 'page'
  readonly path: string
  readonly source: string
  readonly status: number
  readonly meta: Readonly<PageMeta>
}

export interface NibResolvedResourceRoute {
  readonly kind: 'resource'
  readonly path: string
  readonly source: string
  readonly status: number
  readonly contentType: string
}

export interface NibResolvedRedirectRoute {
  readonly kind: 'redirect'
  readonly path: string
  readonly source: string
  readonly status: RedirectStatus
  readonly destination: string
}

export type NibResolvedRoute =
  | NibResolvedPageRoute
  | NibResolvedResourceRoute
  | NibResolvedRedirectRoute

export interface NibPageRouteRegistration {
  readonly kind: 'page'
  readonly path: string
  readonly component: ComponentType<any>
  readonly data?: unknown
  readonly meta?: PageMeta
}

export interface NibResourceRouteRegistration {
  readonly kind: 'resource'
  readonly path: string
  readonly body: string
  readonly contentType: string
  readonly status?: number
}

export interface NibRedirectRouteRegistration {
  readonly kind: 'redirect'
  readonly path: string
  readonly destination: string
  readonly status?: RedirectStatus
}

export type NibRouteRegistration =
  | NibPageRouteRegistration
  | NibResourceRouteRegistration
  | NibRedirectRouteRegistration

export interface NibRoutesPluginContext extends NibRendererPluginContext {
  /** File, data-page, and configured redirect routes before plugin routes. */
  readonly routes: readonly NibResolvedRoute[]
}

export interface NibRoutesResolvedPluginContext extends NibRendererPluginContext {
  /** The final immutable route manifest. */
  readonly routes: readonly NibResolvedRoute[]
}

export interface NibRendererExtension {
  wrapPage?(page: ReactNode, context: NibRenderPageContext): ReactNode
  transformPage?(page: NibRenderedPage, context: NibRenderPageContext): NibRenderedPage
  finalize?(context: NibFinalizeContext): Promise<void>
}

export interface NibPlugin {
  readonly name: string
  setup?(context: NibVitePluginContext): Awaitable<NibPluginSetupResult | void>
  vite?(context: NibVitePluginContext): Awaitable<PluginOption>
  routes?(
    context: NibRoutesPluginContext,
  ): Awaitable<NibRouteRegistration | readonly NibRouteRegistration[] | void>
  routesResolved?(context: NibRoutesResolvedPluginContext): Awaitable<void>
  renderer?(context: NibRendererPluginContext): Awaitable<NibRendererExtension | void>
}

export function definePlugin<const PluginDefinition extends NibPlugin>(
  plugin: PluginDefinition,
): PluginDefinition {
  return plugin
}

export function pluginError(
  plugin: Pick<NibPlugin, 'name'>,
  hook: string,
  error: unknown,
  route?: string,
): Error {
  const location = route === undefined ? '' : ` for route ${route}`
  const detail = error instanceof Error && error.message !== '' ? `: ${error.message}` : ''
  return new Error(`Nib plugin ${plugin.name} failed in ${hook}${location}${detail}`, { cause: error })
}

function isVitePlugin(value: unknown): value is Plugin {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { name?: unknown }).name === 'string'
    && (value as { name: string }).name.trim() !== ''
}

/** Resolve Vite's recursive arrays and thenables while preserving contribution order. */
export async function flattenVitePlugins(
  value: Awaitable<PluginOption>,
  plugin: NibPlugin,
): Promise<Plugin[]> {
  const resolved = await value
  if (resolved === undefined || resolved === null || resolved === false) return []
  if (Array.isArray(resolved)) {
    return (await Promise.all(
      resolved.map((item) => flattenVitePlugins(item, plugin)),
    )).flat()
  }
  if (isVitePlugin(resolved)) return [resolved]
  throw new Error(`Nib plugin ${plugin.name} vite() must return a Vite plugin, an array, or false`)
}

export function validateRendererExtension(
  value: NibRendererExtension,
  plugin: NibPlugin,
): NibRendererExtension {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Nib plugin ${plugin.name} renderer() must return an extension object or undefined`)
  }
  for (const hook of ['wrapPage', 'transformPage', 'finalize'] as const) {
    if (value[hook] !== undefined && typeof value[hook] !== 'function') {
      throw new Error(`Nib plugin ${plugin.name} renderer().${hook} must be a function`)
    }
  }
  return value
}

export function validateRenderedPage(
  value: unknown,
  plugin: NibPlugin,
  expectedIslandMarkup?: readonly string[],
): NibRenderedPage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Nib plugin ${plugin.name} transformPage() must return a rendered page object`)
  }
  const page = value as Partial<RenderedPage>
  if (
    typeof page.status !== 'number'
    || !Number.isInteger(page.status)
    || page.status < 200
    || page.status > 599
    || typeof page.head !== 'string'
    || typeof page.html !== 'string'
  ) {
    throw new Error(`Nib plugin ${plugin.name} transformPage() returned an invalid rendered page`)
  }
  if (expectedIslandMarkup !== undefined) {
    const actual = islandMarkup(page.html)
    if (
      actual.length !== expectedIslandMarkup.length
      || actual.some((markup, index) => markup !== expectedIslandMarkup[index])
    ) {
      throw new Error(`Nib plugin ${plugin.name} transformPage() cannot change React island markup`)
    }
  }
  return {
    status: page.status,
    head: page.head,
    html: page.html,
  }
}

function islandMarkup(html: string): string[] {
  const openings = html.match(/<nib-island\b/gi) ?? []
  const markup = html.match(/<nib-island\b[^>]*>[\s\S]*?<\/nib-island\s*>/gi) ?? []
  if (openings.length !== markup.length) return []
  return markup
}

export interface NibRendererPipeline {
  wrapPage(page: ReactNode, context: NibRenderPageContext): ReactNode
  transformPage(page: NibRenderedPage, context: NibRenderPageContext): NibRenderedPage
  finalize(context: NibFinalizeContext): Promise<void>
}

type RegisteredRendererExtension = {
  plugin: NibPlugin
  extension: NibRendererExtension
}

/** Owns renderer-plugin ordering, lifecycle state, and error attribution. */
export async function createRendererPluginPipeline(
  plugins: readonly NibPlugin[],
  context: NibRendererPluginContext,
): Promise<NibRendererPipeline> {
  const extensions: RegisteredRendererExtension[] = []
  for (const plugin of plugins) {
    if (!plugin.renderer) continue
    try {
      const extension = await plugin.renderer(context)
      if (extension !== undefined) {
        extensions.push({ plugin, extension: validateRendererExtension(extension, plugin) })
      }
    } catch (error) {
      throw pluginError(plugin, 'renderer()', error)
    }
  }

  return {
    wrapPage(page, pageContext) {
      let wrapped = page
      for (const { plugin, extension } of [...extensions].reverse()) {
        if (!extension.wrapPage) continue
        try {
          wrapped = extension.wrapPage(wrapped, pageContext)
        } catch (error) {
          throw pluginError(plugin, 'wrapPage()', error, pageContext.route.path)
        }
      }
      return wrapped
    },
    transformPage(page, pageContext) {
      let transformed = page
      const expectedIslandMarkup = islandMarkup(page.html)
      for (const { plugin, extension } of extensions) {
        if (!extension.transformPage) continue
        try {
          transformed = validateRenderedPage(
            extension.transformPage(Object.freeze({ ...transformed }), pageContext),
            plugin,
            expectedIslandMarkup,
          )
        } catch (error) {
          throw pluginError(plugin, 'transformPage()', error, pageContext.route.path)
        }
      }
      return transformed
    },
    async finalize(finalizeContext) {
      for (const { plugin, extension } of extensions) {
        if (!extension.finalize) continue
        try {
          await extension.finalize(finalizeContext)
        } catch (error) {
          throw pluginError(plugin, 'finalize()', error)
        }
      }
    },
  }
}

/** Resolves fresh Vite adapters in configured order for one Vite graph. */
export async function resolveVitePluginContributions(
  plugins: readonly NibPlugin[],
  context: NibVitePluginContext,
): Promise<Plugin[]> {
  const contributions: Plugin[] = []
  for (const plugin of plugins) {
    if (!plugin.vite) continue
    try {
      contributions.push(...await flattenVitePlugins(plugin.vite(context), plugin))
    } catch (error) {
      throw pluginError(plugin, 'vite()', error)
    }
  }
  return contributions
}

/** Resolves declarative content adapters before Vite page discovery. */
export async function resolvePluginSetupContributions(
  plugins: readonly NibPlugin[],
  context: NibVitePluginContext,
): Promise<NibPluginSetupResult> {
  const pageSources: PageSourceDefinition<DataValidator<any>>[] = []
  for (const plugin of plugins) {
    if (!plugin.setup) continue
    try {
      const contribution = await plugin.setup(context)
      if (contribution === undefined) continue
      if (
        contribution === null
        || typeof contribution !== 'object'
        || Array.isArray(contribution)
        || (
          contribution.pageSources !== undefined
          && !Array.isArray(contribution.pageSources)
        )
      ) {
        throw new Error('setup() must return an object with an optional pageSources array')
      }
      pageSources.push(...contribution.pageSources ?? [])
    } catch (error) {
      throw pluginError(plugin, 'setup()', error)
    }
  }
  return { pageSources }
}

function readonlyResolvedRoute(route: ResolvedRoute): NibResolvedRoute {
  if (route.kind === 'page') {
    return Object.freeze({
      kind: 'page',
      path: route.path,
      source: route.source,
      status: route.status,
      meta: Object.freeze({ ...route.meta }),
    })
  }
  if (route.kind === 'resource') {
    return Object.freeze({
      kind: 'resource',
      path: route.path,
      source: route.source,
      status: route.status,
      contentType: route.contentType,
    })
  }
  return Object.freeze({
    kind: 'redirect',
    path: route.path,
    source: route.source,
    status: route.status,
    destination: route.destination,
  })
}

export function resolvedRouteSnapshots(
  routes: Iterable<ResolvedRoute>,
): readonly NibResolvedRoute[] {
  return Object.freeze([...routes].map(readonlyResolvedRoute))
}

export interface OwnedRouteRegistration {
  readonly plugin: NibPlugin
  readonly route: NibRouteRegistration
}

/** Invokes route providers against one shared immutable initial manifest. */
export async function resolvePluginRouteContributions(
  plugins: readonly NibPlugin[],
  context: Omit<NibRoutesPluginContext, 'routes'>,
  routes: readonly NibResolvedRoute[],
): Promise<OwnedRouteRegistration[]> {
  const contributions: OwnedRouteRegistration[] = []
  for (const plugin of plugins) {
    if (!plugin.routes) continue
    try {
      const result = await plugin.routes(Object.freeze({ ...context, routes }))
      if (result === undefined) continue
      const registered = Array.isArray(result) ? result : [result]
      contributions.push(...registered.map((route) => ({ plugin, route })))
    } catch (error) {
      throw pluginError(plugin, 'routes()', error)
    }
  }
  return contributions
}

/** Runs read-only final route inspection after all route providers resolve. */
export async function inspectResolvedPluginRoutes(
  plugins: readonly NibPlugin[],
  context: Omit<NibRoutesResolvedPluginContext, 'routes'>,
  routes: readonly NibResolvedRoute[],
): Promise<void> {
  for (const plugin of plugins) {
    if (!plugin.routesResolved) continue
    try {
      await plugin.routesResolved(Object.freeze({ ...context, routes }))
    } catch (error) {
      throw pluginError(plugin, 'routesResolved()', error)
    }
  }
}
