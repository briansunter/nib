import { definePlugin, type NibPlugin } from '../framework/plugin'

export interface ClientNavigationPluginOptions {
  /** Ordinary links use hover intent by default; explicit requires annotations. */
  readonly prefetch?: 'hover' | 'explicit'
}

/**
 * Enables Nib's site-wide static document navigation. Ordinary links remain
 * the complete fallback when the browser entry cannot start or navigate.
 */
export function clientNavigation(
  options: ClientNavigationPluginOptions = {},
): NibPlugin {
  const prefetch = options.prefetch ?? 'hover'
  if (prefetch !== 'hover' && prefetch !== 'explicit') {
    throw new Error(`Unsupported Nib navigation prefetch policy: ${String(prefetch)}`)
  }
  return definePlugin({
    name: 'nib-client-navigation',
    clientEntries: [{
      module: '@briansunter/nib/client/navigation',
      initializer: prefetch === 'explicit'
        ? 'initializeExplicitClientNavigation'
        : 'initializeClientNavigation',
    }],
  })
}
