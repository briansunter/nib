import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'
import {
  destroyArtMasonry,
  initArtMasonry,
} from '../utils/artMasonryInitializer'
import {
  destroyPhotoNav,
  initPhotoNav,
} from '../utils/photoNavInitializer'
import { initPhotoSwipe } from '../utils/photoSwipeInitializer'

export default defineBehaviorClient('art-gallery', () => {
  initPhotoSwipe()
  initPhotoNav()
  initArtMasonry()
  return () => {
    destroyPhotoNav()
    destroyArtMasonry()
  }
})
