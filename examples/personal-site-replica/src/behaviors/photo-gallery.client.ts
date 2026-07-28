import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'
import {
  destroyMaps,
  initMaps,
  invalidateVisibleMaps,
} from '../utils/mapInitializer'
import {
  destroyPhotoMasonry,
  initPhotoMasonry,
} from '../utils/photoMasonryInitializer'
import {
  destroyPhotoNav,
  initPhotoNav,
} from '../utils/photoNavInitializer'
import { initPhotoSwipe } from '../utils/photoSwipeInitializer'

export default defineBehaviorClient('photo-gallery', () => {
  initPhotoSwipe()
  initPhotoNav({ invalidateMaps: invalidateVisibleMaps })
  initPhotoMasonry()
  initMaps({ lazy: true })
  return () => {
    destroyPhotoNav()
    destroyMaps()
    destroyPhotoMasonry()
  }
})
