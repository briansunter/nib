import type { ComponentType, ReactNode } from 'react'
import type { Plugin, PluginOption } from 'vite'
import type { PublicationManifest } from './publication'
import { ownedClientMarkup, type OwnedClientMarkup } from './html-document'
import type {
  HeadContribution,
  HeadElement,
  PageMeta,
  PageSourceDefinition,
  DataValidator,
  RedirectStatus,
  RenderedPage,
  PageRoute,
  RouteSnapshot,
  ResolvedRoute,
  SiteConfig,
  CollectionCapability,
} from './types'
import { normalizeHeadContribution } from './meta'

export type NibCommand = 'build' | 'serve'
export type NibMode = 'development' | 'production'
export type NibViteTarget = 'client' | 'server' | 'development'
/** The two intentional setup calls made for a page-source graph. */
export type NibPluginSetupPhase = 'vite-config' | 'page-source-module'
export type Awaitable<Value> = Value | Promise<Value>

export type NibPluginSiteConfig = Readonly<
  Omit<SiteConfig, 'navigation'>
  & {
    readonly navigation?: readonly Readonly<NonNullable<SiteConfig['navigation']>[number]>[]
  }
>

/** Stable page facts available to renderer hooks. */
export type NibPluginRoute = PageRoute

/** A plugin may alter static output, but hydration ownership remains with Nib. */
export type NibRenderedPage = Readonly<Omit<RenderedPage, 'islands' | 'behaviors'>>

export interface NibVitePluginContext {
  readonly command: NibCommand
  readonly mode: NibMode
  /** The Vite graph receiving this fresh plugin instance. */
  readonly target: NibViteTarget
  readonly root: string
  readonly base: string
  readonly configPath: string
}

export interface NibPluginSetupContext extends NibVitePluginContext {
  /**
   * `vite-config` discovers extensions before Vite is constructed;
   * `page-source-module` recreates definitions inside the generated server
   * graph. Setup must be deterministic across these phases.
   */
  readonly phase: NibPluginSetupPhase
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
  readonly site: NibPluginSiteConfig
  readonly root: string
  readonly base: string
  readonly mode: NibMode
}

export interface NibFinalizeContext extends NibRendererPluginContext {
  readonly clientDirectory: string
  /** Immutable route-to-artifact mapping for the completed publication. */
  readonly publication: PublicationManifest
  readonly renderedPaths: readonly string[]
}

export interface NibPluginSetupResult {
  readonly pageSources?: readonly PageSourceDefinition<DataValidator<any>>[]
  /**
   * Browser-only initializers imported into one generated, site-wide entry.
   * Modules are named as strings so plugin configuration stays server-safe.
   */
  readonly clientEntries?: readonly NibClientEntry[]
}

export interface NibClientEntry {
  readonly module: string
  /**
   * Exported browser initializer. It may return a cleanup callback or an
   * object with destroy(), both of which Nib invokes before HMR replacement.
   */
  readonly initializer: string
}

/** Route snapshots exposed to route providers and inspection hooks. */
export type NibResolvedPageRoute = PageRoute
export type NibResolvedResourceRoute = Extract<RouteSnapshot, { kind: 'resource' }>
export type NibResolvedRedirectRoute = Extract<RouteSnapshot, { kind: 'redirect' }>
export type NibResolvedRoute = RouteSnapshot

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
  /** Resolves only a collection explicitly granted with fromCollection(). */
  readonly readCollection: <Result>(capability: CollectionCapability<Result>) => Result
}

export interface NibRoutesResolvedPluginContext extends NibRendererPluginContext {
  /** The final immutable route manifest. */
  readonly routes: readonly NibResolvedRoute[]
}

export interface NibRendererExtension {
  /** Contributes structured elements to the generated document head. */
  head?(context: NibRenderPageContext): HeadContribution | void
  wrapPage?(page: ReactNode, context: NibRenderPageContext): ReactNode
  transformPage?(page: NibRenderedPage, context: NibRenderPageContext): NibRenderedPage
  finalize?(context: NibFinalizeContext): Promise<void>
}

export interface NibPlugin {
  readonly name: string
  setup?(context: NibPluginSetupContext): Awaitable<NibPluginSetupResult | void>
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
  for (const hook of ['head', 'wrapPage', 'transformPage', 'finalize'] as const) {
    if (value[hook] !== undefined && typeof value[hook] !== 'function') {
      throw new Error(`Nib plugin ${plugin.name} renderer().${hook} must be a function`)
    }
  }
  return value
}

export function validateRenderedPage(
  value: unknown,
  plugin: NibPlugin,
  expectedClientMarkup?: OwnedClientMarkup,
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
  if (expectedClientMarkup !== undefined) {
    const actual = ownedClientMarkup(page.html)
    if (
      actual.islands.length !== expectedClientMarkup.islands.length
      || actual.islands.some((markup, index) => markup !== expectedClientMarkup.islands[index])
    ) {
      throw new Error(`Nib plugin ${plugin.name} transformPage() cannot change React island markup`)
    }
    if (
      actual.behaviors.length !== expectedClientMarkup.behaviors.length
      || actual.behaviors.some((markup, index) => markup !== expectedClientMarkup.behaviors[index])
    ) {
      throw new Error(
        `Nib plugin ${plugin.name} transformPage() cannot change client behavior markup`,
      )
    }
  }
  return {
    status: page.status,
    head: page.head,
    html: page.html,
  }
}

export interface NibRendererPipeline {
  head(context: NibRenderPageContext): HeadContribution
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
    head(pageContext) {
      const elements: HeadElement[] = []
      for (const { plugin, extension } of extensions) {
        if (!extension.head) continue
        try {
          const contribution = extension.head(pageContext)
          const normalized = normalizeHeadContribution(
            contribution,
            `Nib plugin ${plugin.name} renderer().head()`,
          )
          if (normalized?.elements) elements.push(...normalized.elements)
        } catch (error) {
          throw pluginError(plugin, 'renderer().head()', error, pageContext.route.path)
        }
      }
      return Object.freeze({ elements: Object.freeze(elements) })
    },
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
      const expectedClientMarkup = ownedClientMarkup(page.html)
      for (const { plugin, extension } of extensions) {
        if (!extension.transformPage) continue
        try {
          transformed = validateRenderedPage(
            extension.transformPage(Object.freeze({ ...transformed }), pageContext),
            plugin,
            expectedClientMarkup,
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
  context: NibPluginSetupContext,
): Promise<NibPluginSetupResult> {
  const pageSources: PageSourceDefinition<DataValidator<any>>[] = []
  const clientEntries: NibClientEntry[] = []
  const clientEntryOwners = new Map<string, string>()
  for (const plugin of plugins) {
    if (!plugin.setup) continue
    try {
      const contribution = await plugin.setup(context)
      if (contribution === undefined) continue
      if (
        contribution === null
        || typeof contribution !== 'object'
        || Array.isArray(contribution)
        || (contribution.pageSources !== undefined && !Array.isArray(contribution.pageSources))
        || (contribution.clientEntries !== undefined && !Array.isArray(contribution.clientEntries))
      ) {
        throw new Error(
          'setup() must return an object with optional pageSources and clientEntries arrays',
        )
      }
      pageSources.push(...contribution.pageSources ?? [])
      for (const entry of contribution.clientEntries ?? []) {
        if (
          entry === null
          || typeof entry !== 'object'
          || Array.isArray(entry)
          || typeof entry.module !== 'string'
          || entry.module.trim() === ''
          || entry.module !== entry.module.trim()
          || typeof entry.initializer !== 'string'
          || !/^[$A-Z_a-z][$\w]*$/.test(entry.initializer)
        ) {
          throw new Error(
            'setup().clientEntries must contain a non-empty module and JavaScript initializer name',
          )
        }
        const identity = `${entry.module}#${entry.initializer}`
        const existingOwner = clientEntryOwners.get(identity)
        if (existingOwner !== undefined) {
          throw new Error(
            `client entry ${identity} is duplicated by ${existingOwner} and ${plugin.name}`,
          )
        }
        clientEntryOwners.set(identity, plugin.name)
        clientEntries.push(Object.freeze({
          module: entry.module,
          initializer: entry.initializer,
        }))
      }
    } catch (error) {
      throw pluginError(plugin, 'setup()', error)
    }
  }
  return {
    pageSources: Object.freeze(pageSources),
    clientEntries: Object.freeze(clientEntries),
  }
}

function readonlyResolvedRoute(route: ResolvedRoute): NibResolvedRoute {
  if (route.kind === 'page') {
    const head = normalizeHeadContribution(route.meta.head, `Route ${route.path} head`)
    return Object.freeze({
      kind: 'page',
      path: route.path,
      source: route.source,
      status: route.status,
      meta: Object.freeze({
        ...route.meta,
        ...(head === undefined ? {} : { head }),
      }),
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
