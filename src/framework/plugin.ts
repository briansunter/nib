import type { ComponentType, ReactNode } from 'react'
import type { Plugin, PluginOption } from 'vite'
import type { PublicationManifest } from './publication'
import type {
  HeadContribution,
  HeadElement,
  PageMeta,
  PageSourceDefinition,
  DataValidator,
  RedirectStatus,
  PageRoute,
  RouteSnapshot,
  ResolvedRoute,
  ResolvedSite,
  CollectionCapability,
} from './types'
import { normalizeHeadContribution } from './meta'
import { resolvedRouteSnapshot } from './snapshots'

export type NibCommand = 'build' | 'serve'
export type NibMode = 'development' | 'production'
export type NibViteTarget = 'client' | 'server' | 'development'
export type Awaitable<Value> = Value | Promise<Value>

const rendererExtensionFields = new Set(['head', 'wrapPage', 'finalize'])

export type NibPluginSiteConfig = ResolvedSite

/** Stable page facts available to renderer hooks. */
export type NibPluginRoute = PageRoute

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
  readonly site: NibPluginSiteConfig
  readonly root: string
  readonly base: string
  readonly mode: NibMode
}

export interface NibFinalizeContext extends NibRendererPluginContext {
  readonly clientDirectory: string
  /** Immutable route-to-artifact mapping for the completed publication. */
  readonly publication: PublicationManifest
}

export interface NibClientEntry {
  readonly module: string
  /**
   * Exported browser initializer. It may return a cleanup callback or an
   * object with destroy(), both of which Nib invokes before HMR replacement.
   */
  readonly initializer: string
}

/** Route snapshots exposed to route providers. */
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
  /** Current file, data-page, redirect, and earlier plugin routes. */
  readonly routes: readonly NibResolvedRoute[]
  /** Resolves only a collection explicitly granted with fromCollection(). */
  readonly readCollection: <Result>(capability: CollectionCapability<Result>) => Result
}

export interface NibRendererExtension {
  /** Contributes final metadata overrides and structured document-head elements. */
  head?(context: NibRenderPageContext): HeadContribution | void
  wrapPage?(page: ReactNode, context: NibRenderPageContext): ReactNode
  finalize?(context: NibFinalizeContext): Promise<void>
}

export interface NibPlugin {
  readonly name: string
  /** Declarative page formats contributed before Vite discovers project pages. */
  readonly pageSources?: readonly PageSourceDefinition<DataValidator<any>>[]
  /**
   * Site-wide browser initializers imported into one generated client entry.
   * Modules stay as strings so importing a plugin remains server-safe.
   */
  readonly clientEntries?: readonly NibClientEntry[]
  vite?(context: NibVitePluginContext): Awaitable<PluginOption>
  routes?(
    context: NibRoutesPluginContext,
  ): Awaitable<NibRouteRegistration | readonly NibRouteRegistration[] | void>
  renderer?(context: NibRendererPluginContext): Awaitable<NibRendererExtension | void>
}

export function definePlugin<const PluginDefinition extends NibPlugin>(
  plugin: PluginDefinition,
): PluginDefinition {
  return plugin
}

function pluginError(
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

function validateRendererExtension(
  value: NibRendererExtension,
  plugin: NibPlugin,
): NibRendererExtension {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Nib plugin ${plugin.name} renderer() must return an extension object or undefined`)
  }
  const unsupportedField = Object.keys(value).find((field) => !rendererExtensionFields.has(field))
  if (unsupportedField !== undefined) {
    throw new Error(
      `Nib plugin ${plugin.name} renderer() has unsupported field ${unsupportedField}`,
    )
  }
  for (const hook of ['head', 'wrapPage', 'finalize'] as const) {
    if (value[hook] !== undefined && typeof value[hook] !== 'function') {
      throw new Error(`Nib plugin ${plugin.name} renderer().${hook} must be a function`)
    }
  }
  return value
}

export interface NibRendererPipeline {
  head(context: NibRenderPageContext): HeadContribution
  wrapPage(page: ReactNode, context: NibRenderPageContext): ReactNode
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
      let title: string | undefined
      let description: string | undefined
      for (const { plugin, extension } of extensions) {
        if (!extension.head) continue
        try {
          const contribution = extension.head(pageContext)
          const normalized = normalizeHeadContribution(
            contribution,
            `Nib plugin ${plugin.name} renderer().head()`,
          )
          if (normalized?.title !== undefined) title = normalized.title
          if (normalized?.description !== undefined) description = normalized.description
          if (normalized?.elements) elements.push(...normalized.elements)
        } catch (error) {
          throw pluginError(plugin, 'renderer().head()', error, pageContext.route.path)
        }
      }
      return Object.freeze({
        ...(title === undefined ? {} : { title }),
        ...(description === undefined ? {} : { description }),
        elements: Object.freeze(elements),
      })
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

export function resolvedRouteSnapshots(
  routes: Iterable<ResolvedRoute>,
): readonly NibResolvedRoute[] {
  return Object.freeze([...routes].map(resolvedRouteSnapshot))
}

export interface OwnedRouteRegistration {
  readonly plugin: NibPlugin
  readonly route: NibRouteRegistration
}

/** Invokes one route provider against the latest immutable manifest. */
export async function resolvePluginRouteContribution(
  plugin: NibPlugin,
  context: Omit<NibRoutesPluginContext, 'routes'>,
  routes: readonly NibResolvedRoute[],
): Promise<OwnedRouteRegistration[]> {
  if (!plugin.routes) return []
  try {
    const result = await plugin.routes(Object.freeze({ ...context, routes }))
    if (result === undefined) return []
    const registered = Array.isArray(result) ? result : [result]
    return registered.map((route) => ({ plugin, route }))
  } catch (error) {
    throw pluginError(plugin, 'routes()', error)
  }
}
