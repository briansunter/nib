import { hydrateRoot } from 'react-dom/client'
import { islandFileToId } from './framework/island-paths'
import { hydrateIsland, scheduleHydration } from './framework/island-runtime'
import {
  type HydrationStrategy,
  type IslandModule,
} from './framework/islands'

const islandModules = import.meta.glob<IslandModule>('./islands/**/*.tsx')
const loaders = new Map<string, () => Promise<IslandModule>>()

for (const [file, load] of Object.entries(islandModules)) {
  const id = islandFileToId(file)
  if (loaders.has(id)) throw new Error(`Duplicate island ID: ${id}`)
  loaders.set(id, load)
}

function reportIslandError(id: string, instance: string, error: unknown) {
  console.error(`Failed to hydrate island ${id} (${instance})`, error)
}

for (const element of document.querySelectorAll<HTMLElement>('nib-island[data-island]')) {
  if (element.dataset.scheduled === 'true') continue
  element.dataset.scheduled = 'true'
  const strategy = element.dataset.hydrate as HydrationStrategy | undefined
  if (strategy !== 'load' && strategy !== 'idle' && strategy !== 'visible') {
    reportIslandError(
      element.dataset.island ?? 'unknown',
      element.dataset.instance ?? 'unknown',
      new Error(`Invalid hydration strategy: ${String(strategy)}`),
    )
    continue
  }
  scheduleHydration(element, strategy, () => {
    void hydrateIsland(element, { loaders, hydrateRoot, reportError: reportIslandError }).catch((error) => {
      reportIslandError(
        element.dataset.island ?? 'unknown',
        element.dataset.instance ?? 'unknown',
        error,
      )
    })
  })
}
