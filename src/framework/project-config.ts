import path from 'node:path'
import { loadConfigFromFile, type ConfigEnv } from 'vite'
import { pageSourceExtensions, validateDataDefinition } from './content'
import { deployedOrigin } from './deployed-url'
import { normalizeHeadContribution } from './meta'
import { configuredPageSources } from './plugin-contributions'
import type { NibConfig } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const pluginFields = new Set([
  'name',
  'pageSources',
  'clientEntries',
  'vite',
  'routes',
  'renderer',
])

export function validateNibConfig(value: unknown): NibConfig {
  if (!isRecord(value) || !isRecord(value.site)) {
    throw new Error('nib.config.ts must export an object with a site configuration')
  }
  if (typeof value.site.title !== 'string' || value.site.title.trim() === '') {
    throw new Error('Nib site title must be a non-empty string')
  }
  for (const field of ['description', 'titleTemplate'] as const) {
    if (value.site[field] !== undefined && typeof value.site[field] !== 'string') {
      throw new Error(`Nib site.${field} must be a string`)
    }
  }
  if (value.site.navigation !== undefined) {
    if (
      !Array.isArray(value.site.navigation)
      || value.site.navigation.some((item) => (
        !isRecord(item)
        || typeof item.label !== 'string'
        || item.label.trim() === ''
        || typeof item.href !== 'string'
        || item.href.trim() === ''
      ))
    ) {
      throw new Error('Nib site.navigation must contain non-empty label and href strings')
    }
  }
  if (value.site.origin !== undefined) {
    if (typeof value.site.origin !== 'string') throw new Error('Nib site.origin must be a string')
    deployedOrigin(value.site.origin, undefined, 'Nib site.origin')
  }
  normalizeHeadContribution(value.site.head, 'Nib site.head')
  if (value.base !== undefined) {
    if (
      typeof value.base !== 'string'
      || !value.base.startsWith('/')
      || value.base.startsWith('//')
      || !value.base.endsWith('/')
      || value.base.includes('?')
      || value.base.includes('#')
      || value.base.includes('\\')
    ) {
      throw new Error('Nib base must start and end with "/" and contain no query or hash')
    }
  }
  if (
    value.trailingSlash !== undefined
    && !['always', 'never', 'ignore'].includes(value.trailingSlash as string)
  ) {
    throw new Error('Nib trailingSlash must be "always", "never", or "ignore"')
  }
  if (value.hosting !== undefined) {
    if (!isRecord(value.hosting)) throw new Error('Nib hosting must be an object')
    if (value.hosting.adapters !== undefined) {
      if (
        !Array.isArray(value.hosting.adapters)
        || value.hosting.adapters.some((adapter) => (
          !['netlify', 'vercel', 'cloudflare', 's3'].includes(adapter as string)
        ))
      ) {
        throw new Error('Nib hosting adapters must be netlify, vercel, cloudflare, or s3')
      }
    }
  }
  if (value.redirects !== undefined) {
    if (!isRecord(value.redirects)) throw new Error('Nib redirects must be an object')
    for (const [source, redirect] of Object.entries(value.redirects)) {
      if (
        !source.startsWith('/')
        || source.startsWith('//')
        || source.includes('?')
        || source.includes('#')
      ) {
        throw new Error(`Nib redirect source must be an absolute route path: ${source}`)
      }
      const destination = typeof redirect === 'string'
        ? redirect
        : isRecord(redirect) && typeof redirect.destination === 'string'
          ? redirect.destination
          : undefined
      if (destination === undefined) {
        throw new Error(`Nib redirect ${source} must define a destination`)
      }
      if (
        (!destination.startsWith('/') || destination.startsWith('//'))
        && !/^https?:\/\//i.test(destination)
      ) {
        throw new Error(`Nib redirect destination must be an absolute path or HTTP(S) URL: ${destination}`)
      }
      if (
        isRecord(redirect)
        && redirect.status !== undefined
        && ![301, 302, 307, 308].includes(redirect.status as number)
      ) {
        throw new Error(`Nib redirect ${source} has an unsupported status`)
      }
    }
  }
  if (value.shell !== undefined && typeof value.shell !== 'function') {
    throw new Error('Nib shell must be a React component')
  }
  if (value.vite !== undefined && typeof value.vite !== 'function') {
    throw new Error('Nib vite must be a function that returns Vite plugins')
  }
  if (value.plugins !== undefined) {
    if (!Array.isArray(value.plugins)) throw new Error('Nib plugins must be an array')
    const names = new Set<string>()
    const clientEntryOwners = new Map<string, string>()
    for (const plugin of value.plugins) {
      if (
        !isRecord(plugin)
        || typeof plugin.name !== 'string'
        || plugin.name.trim() === ''
        || plugin.name !== plugin.name.trim()
      ) {
        throw new Error('Each Nib plugin must have a non-empty name')
      }
      if (names.has(plugin.name)) throw new Error(`Nib plugin name is duplicated: ${plugin.name}`)
      names.add(plugin.name)
      const unsupportedField = Object.keys(plugin).find((field) => !pluginFields.has(field))
      if (unsupportedField !== undefined) {
        throw new Error(`Nib plugin ${plugin.name} has unsupported field ${unsupportedField}`)
      }
      for (const hook of ['vite', 'routes', 'renderer'] as const) {
        if (plugin[hook] !== undefined && typeof plugin[hook] !== 'function') {
          throw new Error(`Nib plugin ${plugin.name} ${hook} hook must be a function`)
        }
      }
      if (plugin.pageSources !== undefined && !Array.isArray(plugin.pageSources)) {
        throw new Error(`Nib plugin ${plugin.name} pageSources must be an array`)
      }
      if (plugin.clientEntries !== undefined && !Array.isArray(plugin.clientEntries)) {
        throw new Error(`Nib plugin ${plugin.name} clientEntries must be an array`)
      }
      for (const entry of plugin.clientEntries ?? []) {
        if (
          !isRecord(entry)
          || typeof entry.module !== 'string'
          || entry.module.trim() === ''
          || entry.module !== entry.module.trim()
          || typeof entry.initializer !== 'string'
          || !/^[$A-Z_a-z][$\w]*$/.test(entry.initializer)
        ) {
          throw new Error(
            `Nib plugin ${plugin.name} clientEntries must contain a non-empty module `
            + 'and JavaScript initializer name',
          )
        }
        const identity = `${entry.module}#${entry.initializer}`
        const existingOwner = clientEntryOwners.get(identity)
        if (existingOwner !== undefined) {
          throw new Error(
            `Nib client entry ${identity} is duplicated by ${existingOwner} and ${plugin.name}`,
          )
        }
        clientEntryOwners.set(identity, plugin.name)
      }
    }
  }
  if (value.markdown !== undefined) {
    validateDataDefinition(value.markdown, 'Nib markdown configuration')
    const markdown = value.markdown as Record<string, unknown>
    for (const option of ['gfm', 'allowDangerousHtml'] as const) {
      if (markdown[option] !== undefined && typeof markdown[option] !== 'boolean') {
        throw new Error(`Nib markdown ${option} must be a boolean`)
      }
    }
    for (const plugins of ['remarkPlugins', 'rehypePlugins'] as const) {
      if (markdown[plugins] !== undefined && !Array.isArray(markdown[plugins])) {
        throw new Error(`Nib markdown ${plugins} must be an array`)
      }
    }
  }
  if (value.pageSources !== undefined) {
    if (!Array.isArray(value.pageSources)) throw new Error('Nib pageSources must be an array')
  }
  if (value.collections !== undefined) {
    if (!isRecord(value.collections)) throw new Error('Nib collections must be an object')
    for (const [name, definition] of Object.entries(value.collections)) {
      if (!isRecord(definition)) {
        throw new Error(`Collection ${name} must define a loader function`)
      }
      if ('source' in definition) {
        continue
      }
      if ('pages' in definition) {
        if (
          definition.pages !== true
          || typeof definition.markdownOnly !== 'boolean'
          || typeof definition.match !== 'function'
          || typeof definition.id !== 'function'
          || typeof definition.select !== 'function'
          || (definition.sort !== undefined && typeof definition.sort !== 'function')
        ) {
          throw new Error(
            `Collection ${name} page selector must define match, id, select, `
            + 'and an optional sort function',
          )
        }
        continue
      }
      if (typeof definition.loader !== 'function') {
        throw new Error(`Collection ${name} must define a loader function`)
      }
      validateDataDefinition(definition, `Collection ${name}`)
    }
  }
  pageSourceExtensions(configuredPageSources(value as unknown as NibConfig))
  return value as unknown as NibConfig
}

export function resolveBasePath(
  config: NibConfig,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  if (config.base) return config.base
  if (environment.SITE_BASE_PATH) {
    return validateNibConfig({
      ...config,
      base: environment.SITE_BASE_PATH,
    }).base ?? '/'
  }
  const repository = environment.GITHUB_REPOSITORY?.split('/')[1]
  if (environment.GITHUB_ACTIONS === 'true' && repository) return `/${repository}/`
  return '/'
}

export async function loadNibConfig(
  root: string,
  command: ConfigEnv['command'],
): Promise<{ config: NibConfig; configPath: string }> {
  const configPath = path.join(root, 'nib.config.ts')
  const loaded = await loadConfigFromFile(
    { command, mode: command === 'serve' ? 'development' : 'production' },
    configPath,
    root,
  )
  if (!loaded) throw new Error(`Missing Nib configuration: ${configPath}`)
  return {
    config: validateNibConfig(loaded.config),
    configPath,
  }
}
