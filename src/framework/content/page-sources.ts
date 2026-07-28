import type { NibConfig, PageSourceDefinition } from '../types'

/** Collects every declared or collection-referenced source once by identity. */
export function configuredPageSources(
  config: Pick<NibConfig, 'pageSources' | 'plugins' | 'collections'>,
): readonly PageSourceDefinition<any>[] {
  const definitions = [
    ...(config.pageSources ?? []),
    ...(config.plugins ?? []).flatMap((plugin) => plugin.pageSources ?? []),
    ...Object.values(config.collections ?? {}).flatMap((definition) => (
      'source' in definition ? [definition.source] : []
    )),
  ]
  return Object.freeze([...new Set(definitions)])
}
