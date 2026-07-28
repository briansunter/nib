import { definePlugin, type NibPlugin } from './framework/plugin'

/**
 * Enables Nib's site-wide static document navigation. Ordinary links remain
 * the complete fallback when the browser entry cannot start or navigate.
 */
export function clientNavigation(): NibPlugin {
  return definePlugin({
    name: 'nib-client-navigation',
    setup(context) {
      if (
        context.phase !== 'vite-config'
        || (context.target !== 'client' && context.target !== 'development')
      ) {
        return
      }
      return {
        clientEntries: [{
          module: '@briansunter/nib/client/navigation',
          initializer: 'startClientNavigation',
        }],
      }
    },
  })
}
