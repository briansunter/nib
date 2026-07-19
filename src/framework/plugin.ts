import type { ReactNode } from 'react'
import type { Plugin, PluginOption } from 'vite'
import type { RenderedPage, ResolvedRoute, SiteConfig } from './types'

export type NibCommand = 'build' | 'serve'
export type Awaitable<Value> = Value | Promise<Value>

export interface NibVitePluginContext {
  readonly command: NibCommand
  readonly mode: 'development' | 'production'
  readonly root: string
  readonly base: string
  readonly configPath: string
}

export interface NibRendererPluginContext {
  readonly command: NibCommand
  readonly mode: 'development' | 'production'
  readonly root: string
  readonly base: string
  readonly site: SiteConfig
}

export interface NibRenderPageContext {
  readonly route: ResolvedRoute
  readonly root: string
  readonly base: string
  readonly mode: 'development' | 'production'
}

export interface NibFinalizeContext {
  readonly root: string
  readonly base: string
  readonly clientDirectory: string
  readonly renderedPaths: readonly string[]
}

export interface NibRendererExtension {
  wrapPage?(page: ReactNode, context: NibRenderPageContext): ReactNode
  transformPage?(page: RenderedPage, context: NibRenderPageContext): RenderedPage
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
  return new Error(`Nib plugin ${plugin.name} failed in ${hook}${location}`, { cause: error })
}

function isVitePlugin(value: unknown): value is Plugin {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { name?: unknown }).name === 'string'
    && (value as { name: string }).name.trim() !== ''
}

/** Flatten the subset of Vite PluginOption that is meaningful after awaiting a Nib hook. */
export function flattenVitePlugins(value: PluginOption, plugin: NibPlugin): Plugin[] {
  if (value === undefined || value === null || value === false) return []
  if (Array.isArray(value)) return value.flatMap((item) => flattenVitePlugins(item, plugin))
  if (isVitePlugin(value)) return [value]
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

export function validateRenderedPage(value: unknown, plugin: NibPlugin): RenderedPage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Nib plugin ${plugin.name} transformPage() must return a rendered page object`)
  }
  const page = value as Partial<RenderedPage>
  if (
    !Number.isInteger(page.status)
    || typeof page.head !== 'string'
    || typeof page.html !== 'string'
    || !Array.isArray(page.islands)
    || !page.islands.every((island) => typeof island === 'string')
  ) {
    throw new Error(`Nib plugin ${plugin.name} transformPage() returned an invalid rendered page`)
  }
  return page as RenderedPage
}
