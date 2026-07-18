import { StrictMode, createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { islandFileToId } from './framework/island-paths'
import { parseIslandProps } from './framework/island-serialization'
import {
  IslandRenderContext,
  isIslandDefinition,
  nestedIslandRenderer,
  validateIslandModule,
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

async function hydrateIsland(element: HTMLElement) {
  const id = element.dataset.island
  const instance = element.dataset.instance
  const identifierPrefix = element.dataset.prefix
  const serializedProps = element.dataset.props
  if (!id || !instance || !identifierPrefix || serializedProps === undefined) {
    throw new Error('Island element is missing hydration metadata')
  }

  const load = loaders.get(id)
  if (!load) throw new Error(`No client module found for island ${id}`)
  const module = await load()
  const definition = validateIslandModule(`/src/islands/${id}.tsx`, module)
  if (!isIslandDefinition(definition)) throw new Error(`Invalid island definition: ${id}`)

  const props = parseIslandProps(serializedProps)
  hydrateRoot(
    element,
    createElement(
      IslandRenderContext.Provider,
      { value: nestedIslandRenderer(id) },
      createElement(
        StrictMode,
        null,
        createElement(definition.Component, props),
      ),
    ),
    {
      identifierPrefix,
      onRecoverableError(error) {
        reportIslandError(id, instance, error)
      },
    },
  )
}

function scheduleHydration(
  element: HTMLElement,
  strategy: HydrationStrategy,
  hydrate: () => void,
) {
  if (strategy === 'load') {
    hydrate()
    return
  }
  if (strategy === 'idle') {
    const requestIdleCallback = (
      window as Window & { requestIdleCallback?: (callback: () => void) => number }
    ).requestIdleCallback
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback.call(window, hydrate)
    } else {
      window.setTimeout(hydrate, 1)
    }
    return
  }

  if (!('IntersectionObserver' in window)) {
    hydrate()
    return
  }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return
    observer.disconnect()
    hydrate()
  }, { rootMargin: '200px' })
  observer.observe(element.firstElementChild ?? element)
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
    void hydrateIsland(element).catch((error) => {
      reportIslandError(
        element.dataset.island ?? 'unknown',
        element.dataset.instance ?? 'unknown',
        error,
      )
    })
  })
}
