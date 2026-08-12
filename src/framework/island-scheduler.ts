import type { IslandHydrationStrategy } from './island-strategy'

export interface IslandHydrationEnvironment {
  IntersectionObserver?: typeof window.IntersectionObserver
}

export interface ScheduledIslandHydration {
  cancel(): void
}

export function islandVisibilityTargets(element: HTMLElement): Element[] {
  const children = [...element.children]
  return children.length > 0 ? children : [element.parentElement ?? element]
}

export function scheduleIslandHydration(
  element: HTMLElement,
  strategy: IslandHydrationStrategy,
  hydrate: () => void,
  environment: IslandHydrationEnvironment = window,
): ScheduledIslandHydration {
  let finished = false
  let cancelPending = () => {}
  const runOnce = () => {
    if (finished) return
    finished = true
    cancelPending()
    hydrate()
  }
  const scheduled: ScheduledIslandHydration = {
    cancel() {
      if (finished) return
      finished = true
      cancelPending()
    },
  }

  if (strategy === 'load' || environment.IntersectionObserver === undefined) {
    runOnce()
    return scheduled
  }

  const observer = new environment.IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) runOnce()
  }, { rootMargin: '200px' })
  cancelPending = () => observer.disconnect()
  for (const target of islandVisibilityTargets(element)) observer.observe(target)
  return scheduled
}
