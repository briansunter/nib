import type { NibClientEntry } from './plugin'
import type { NibConfig } from './types'

export { configuredPageSources } from './content/page-sources'

/** Returns immutable copies of declarative client entries in plugin order. */
export function configuredClientEntries(
  config: Pick<NibConfig, 'plugins'>,
): readonly NibClientEntry[] {
  return Object.freeze(
    (config.plugins ?? []).flatMap((plugin) => (
      (plugin.clientEntries ?? []).map((entry) => Object.freeze({ ...entry }))
    )),
  )
}
