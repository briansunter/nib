import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'
import {
  destroyCopyCodeButtons,
  initCopyCodeButtons,
} from '../utils/copyCodeInitializer'

export default defineBehaviorClient('bitcoin-copy-behavior', () => {
  initCopyCodeButtons()
  return destroyCopyCodeButtons
})
