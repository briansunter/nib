import { defineIsland } from '@briansunter/nib'
import { useEffect } from 'react'
import {
  destroyCopyCodeButtons,
  initCopyCodeButtons,
} from '../utils/copyCodeInitializer'

function BitcoinCopyBehavior() {
  useEffect(() => {
    initCopyCodeButtons()
    return destroyCopyCodeButtons
  }, [])

  return null
}

export default defineIsland('bitcoin-copy-behavior', BitcoinCopyBehavior)
