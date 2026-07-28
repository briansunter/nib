import { defineIsland } from '@briansunter/nib'
import { useEffect } from 'react'

/**
 * The collection itself, toolbar, map shell, and modal are server rendered.
 * This zero-markup island attaches the source site's DOM behavior without
 * serializing the 131-pin collection through React hydration props.
 */
function PinCollectionBehavior() {
  useEffect(() => {
    let active = true
    let destroy: (() => void) | undefined

    void import('../utils/pinCollectionInitializer').then((module) => {
      if (!active) return
      module.initPinCollection()
      destroy = module.destroyPinCollection
    })

    return () => {
      active = false
      destroy?.()
    }
  }, [])

  return null
}

export default defineIsland('pin-filter', PinCollectionBehavior)
