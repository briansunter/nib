import {
  defineBehaviorClient,
} from '@briansunter/nib/client/behaviors'
import { initSiteShell } from '../utils/shellInitializer'

export default defineBehaviorClient('shell-behavior', () => {
  return initSiteShell()
})
