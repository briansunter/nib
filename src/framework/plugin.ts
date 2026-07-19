import type { ReactNode } from 'react'
import type { Plugin, PluginOption } from 'vite'
import type { RenderedPage, ResolvedRoute, SiteConfig } from './types'

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

export type NibPluginRoute = Readonly<
  Omit<ResolvedRoute, 'layouts' | 'meta'>
  & {
    readonly layouts: readonly ResolvedRoute['layouts'][number][]
    readonly meta: Readonly<ResolvedRoute['meta']>
  }
>

export type NibRenderedPage = Readonly<
  Omit<RenderedPage, 'islands'>
  & { readonly islands: readonly string[] }
>

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

export interface NibRendererExtension {
  wrapPage?(page: ReactNode, context: NibRenderPageContext): ReactNode
  transformPage?(page: NibRenderedPage, context: NibRenderPageContext): NibRenderedPage
  finalize?(context: NibFinalizeContext): Promise<void>
}

export interface NibPlugin {
  readonly name: string
  vite?(context: NibVitePluginContext): Awaitable<PluginOption>
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
  expectedIslands?: readonly string[],
): RenderedPage {
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
    || !Array.isArray(page.islands)
    || !page.islands.every((island) => typeof island === 'string')
  ) {
    throw new Error(`Nib plugin ${plugin.name} transformPage() returned an invalid rendered page`)
  }
  if (
    expectedIslands !== undefined
    && (
      page.islands.length !== expectedIslands.length
      || page.islands.some((island, index) => island !== expectedIslands[index])
    )
  ) {
    throw new Error(`Nib plugin ${plugin.name} transformPage() cannot change React island IDs`)
  }
  return {
    status: page.status,
    head: page.head,
    html: page.html,
    islands: [...page.islands],
  } as RenderedPage
}
