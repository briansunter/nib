import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'
import {
  destroyPinCollection,
  initPinCollection,
} from '../utils/pinCollectionInitializer'

export default defineBehaviorClient('pin-filter', () => {
  initPinCollection()
  return destroyPinCollection
})
