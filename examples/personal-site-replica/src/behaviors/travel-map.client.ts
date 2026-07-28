import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'
import {
  destroyTravelMap,
  initTravelMap,
} from '../utils/travelMapInitializer'

const BODY_CLASSES = [
  'travel-page',
  'min-h-screen',
  'font-sans',
  'bg-surface',
  'text-ink',
  'transition-colors',
  'overscroll-none',
]

export default defineBehaviorClient('travel-map', () => {
  document.body.classList.add(...BODY_CLASSES)
  initTravelMap()
  return () => {
    destroyTravelMap()
    document.body.classList.remove(...BODY_CLASSES)
  }
})
