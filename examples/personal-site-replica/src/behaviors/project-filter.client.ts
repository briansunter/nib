import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'
import {
  destroyProjectBrowser,
  initProjectBrowser,
} from '../utils/projectBrowserInitializer'

export default defineBehaviorClient('project-filter', () => {
  initProjectBrowser()
  return destroyProjectBrowser
})
