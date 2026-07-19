import path from 'node:path'
import { loadConfigFromFile, type ConfigEnv } from 'vite'
import type { NibConfig } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function validateNibConfig(value: unknown): NibConfig {
  if (!isRecord(value) || !isRecord(value.site)) {
    throw new Error('nib.config.ts must export an object with a site configuration')
  }
  if (typeof value.site.title !== 'string' || value.site.title.trim() === '') {
    throw new Error('Nib site title must be a non-empty string')
  }
  if (value.base !== undefined) {
    if (
      typeof value.base !== 'string'
      || !value.base.startsWith('/')
      || !value.base.endsWith('/')
      || value.base.includes('?')
      || value.base.includes('#')
    ) {
      throw new Error('Nib base must start and end with "/" and contain no query or hash')
    }
  }
  if (value.shell !== undefined && typeof value.shell !== 'function') {
    throw new Error('Nib shell must be a React component')
  }
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
