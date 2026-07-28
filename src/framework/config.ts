import type { NibConfig } from './types'

type ExactConfig<Config extends NibConfig> =
  Config & Record<Exclude<keyof Config, keyof NibConfig>, never>

export function defineConfig<const Config extends NibConfig>(
  config: ExactConfig<Config>,
): Config {
  return config
}
