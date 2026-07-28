import { defineIsland } from '@briansunter/nib'
import { useEffect } from 'react'
import {
  destroyProjectBrowser,
  initProjectBrowser,
} from '../utils/projectBrowserInitializer'

function ProjectFilter() {
  useEffect(() => {
    initProjectBrowser()
    return destroyProjectBrowser
  }, [])

  return null
}

export default defineIsland('project-filter', ProjectFilter)
