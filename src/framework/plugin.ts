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

/** Stable route facts available to renderer plugins. Framework implementation
 * details such as the page module, layouts, and page data remain private. */
export interface NibPluginRoute {
  readonly path: string
  readonly source: string
  readonly status: number
  readonly meta: Readonly<ResolvedRoute['meta']>
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
