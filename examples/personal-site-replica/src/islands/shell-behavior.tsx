import { defineIsland } from '@briansunter/nib'
import { useEffect } from 'react'
import { initClientNavigation } from '../utils/clientNavigationInitializer'
import { initSiteShell } from '../utils/shellInitializer'

declare global {
  interface Window {
    __nibStartIslandRuntime?: () => void
  }
}

function ShellBehavior() {
  useEffect(() => {
    initClientNavigation({
      rehydrate: () => window.__nibStartIslandRuntime?.(),
    })
    return initSiteShell()
  }, [])
  return null
}

export default defineIsland('shell-behavior', ShellBehavior)
