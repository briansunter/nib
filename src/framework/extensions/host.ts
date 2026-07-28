import type { ReactNode } from 'react'
import type { Plugin, PluginOption } from 'vite'
import type {
  HeadContribution,
  HeadElement,
  ResolvedRoute,
} from '../types'
import { normalizeHeadContribution } from '../meta'
import { resolvedRouteSnapshot } from '../snapshots'
import type {
  Awaitable,
  NibFinalizeContext,
  NibPlugin,
  NibRendererExtension,
  NibRendererPluginContext,
  NibRenderPageContext,
  NibResolvedRoute,
  NibRouteRegistration,
  NibRoutesPluginContext,
  NibVitePluginContext,
} from './contracts'

const rendererExtensionFields = new Set(['head', 'wrapPage', 'finalize'])

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
