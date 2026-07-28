import type { HydrationStrategy } from './islands'

export interface HydrationEnvironment {
  requestIdleCallback?: (callback: () => void) => number
  cancelIdleCallback?: (handle: number) => void
  setTimeout: (callback: () => void, delay: number) => number
  clearTimeout?: (handle: number) => void
  IntersectionObserver?: typeof window.IntersectionObserver
}

export interface ScheduledHydration {
  cancel(): void
}

export function visibilityTargets(element: HTMLElement): Element[] {
  const children = [...element.children]
  return children.length > 0 ? children : [element.parentElement ?? element]
}

export function scheduleHydration(
  element: HTMLElement,
  strategy: HydrationStrategy,
  hydrate: () => void,
  environment: HydrationEnvironment = window,
): ScheduledHydration {
  let finished = false
  let cancelPending = () => {}
  const hydrateOnce = () => {
    if (finished) return
    finished = true
    cancelPending()
    hydrate()
  }
  const scheduled: ScheduledHydration = {
    cancel() {
      if (finished) return
      finished = true
      cancelPending()
    },
  }

  if (strategy === 'load') {
    hydrateOnce()
    return scheduled
  }
  if (strategy === 'idle') {
    if (typeof environment.requestIdleCallback === 'function') {
      const handle = environment.requestIdleCallback(hydrateOnce)
      cancelPending = () => environment.cancelIdleCallback?.(handle)
    } else {
      const handle = environment.setTimeout(hydrateOnce, 1)
      cancelPending = () => environment.clearTimeout?.(handle)
    }
    return scheduled
  }

  if (!environment.IntersectionObserver) {
    hydrateOnce()
    return scheduled
  }

  const observer = new environment.IntersectionObserver((entries) => {
    if (finished || !entries.some((entry) => entry.isIntersecting)) return
    hydrateOnce()
  }, { rootMargin: '200px' })
  cancelPending = () => observer.disconnect()
  for (const target of visibilityTargets(element)) observer.observe(target)
  return scheduled
}
