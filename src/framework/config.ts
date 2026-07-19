import type { NibConfig } from './types'

export function defineConfig<const Config extends NibConfig>(config: Config): Config {
  return config
}
