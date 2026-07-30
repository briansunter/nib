import type { ComponentType, ReactNode } from 'react'
import type { PluginOption } from 'vite'
import type { NibBuildCache } from '../cache'
import type { PublicationManifest } from '../publication'
import type {
  CollectionCapability,
  DataValidator,
  NibBuildOutput,
  PageMeta,
  PageRoute,
  PageSourceDefinition,
  RedirectStatus,
  RouteSnapshot,
} from '../types'

export type NibCommand = 'build' | 'serve'
export type NibMode = 'development' | 'production'
export type NibViteTarget = 'client' | 'server' | 'development'
export type Awaitable<Value> = Value | Promise<Value>
export type NibPluginRoute = PageRoute

export interface NibVitePluginContext {
  readonly command: NibCommand
  readonly mode: NibMode
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
  readonly origin?: string
}

export interface NibRenderPageContext {
  readonly command: NibCommand
  readonly route: NibPluginRoute
  readonly root: string
  readonly base: string
  readonly origin?: string
  readonly mode: NibMode
  /** Full parsed frontmatter (custom fields beyond PageMeta); undefined when absent. */
  readonly frontmatter?: unknown
  /** Data-page payload (page sources / collections); undefined for markdown-only routes. */
  readonly data?: unknown
}

export interface NibFinalizeContext extends NibRendererPluginContext {
  readonly clientDirectory: string
  readonly publication: PublicationManifest
  readCollection<Result>(capability: CollectionCapability<Result>): Result
  readonly output: NibBuildOutput
  /** Format-neutral persistent build cache for deterministic generators (e.g. OG images). */
  readonly cache: NibBuildCache
}

export interface NibClientEntry {
  readonly module: string
  readonly initializer: string
}

export type NibResolvedPageRoute = PageRoute
export type NibResolvedResourceRoute = Extract<RouteSnapshot, { kind: 'resource' }>
export type NibResolvedRedirectRoute = Extract<RouteSnapshot, { kind: 'redirect' }>
export type NibResolvedRoute = RouteSnapshot

export interface NibPageRouteRegistration {
  readonly kind: 'page'
  readonly path: string
  readonly component: ComponentType<any>
  readonly data?: unknown
  readonly meta: PageMeta
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
  readonly routes: readonly NibResolvedRoute[]
  readonly readCollection: <Result>(capability: CollectionCapability<Result>) => Result
}

export interface NibRendererExtension {
  head?(context: NibRenderPageContext): import('../types').HeadContribution | void
  wrapPage?(page: ReactNode, context: NibRenderPageContext): ReactNode
  finalize?(context: NibFinalizeContext): Promise<void>
}

export interface NibPlugin {
  readonly name: string
  readonly pageSources?: readonly PageSourceDefinition<DataValidator<any>>[]
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
