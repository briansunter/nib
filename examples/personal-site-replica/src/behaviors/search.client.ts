import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'
import '../styles/integrations/pagefind.css'
import '../styles/integrations/search.css'
import { initSearch } from '../utils/searchInitializer'

export default defineBehaviorClient('search', ({ root, signal }) => {
  return initSearch(root, signal)
})
