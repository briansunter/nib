import {
  defineBehaviorClient,
  mountClientRuntimes,
  unmountClientRuntimes,
} from '@briansunter/nib/client/behaviors'
import { initClientNavigation } from '../utils/clientNavigationInitializer'
import { initSiteShell } from '../utils/shellInitializer'

export default defineBehaviorClient('shell-behavior', () => {
  initClientNavigation({
    mount: mountClientRuntimes,
    unmount: unmountClientRuntimes,
  })
  return initSiteShell()
})
