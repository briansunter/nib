import type { ClientMountStrategy } from './hydration'

export interface ClientMountEnvironment {
  requestIdleCallback?: (callback: () => void) => number
  cancelIdleCallback?: (handle: number) => void
  setTimeout: (callback: () => void, delay: number) => number
  clearTimeout?: (handle: number) => void
  IntersectionObserver?: typeof window.IntersectionObserver
}

export interface ScheduledClientMount {
  cancel(): void
}

export function visibilityTargets(element: HTMLElement): Element[] {
  const children = [...element.children]
  return children.length > 0 ? children : [element.parentElement ?? element]
}

export function scheduleClientMount(
  element: HTMLElement,
  strategy: ClientMountStrategy,
  mount: () => void,
  environment: ClientMountEnvironment = window,
): ScheduledClientMount {
  let finished = false
  let cancelPending = () => {}
  const mountOnce = () => {
    if (finished) return
    finished = true
    cancelPending()
    mount()
  }
  const scheduled: ScheduledClientMount = {
    cancel() {
      if (finished) return
      finished = true
      cancelPending()
    },
  }

  if (strategy === 'load') {
    mountOnce()
    return scheduled
  }
  if (strategy === 'idle') {
    if (typeof environment.requestIdleCallback === 'function') {
      const handle = environment.requestIdleCallback(mountOnce)
      cancelPending = () => environment.cancelIdleCallback?.(handle)
    } else {
      const handle = environment.setTimeout(mountOnce, 1)
      cancelPending = () => environment.clearTimeout?.(handle)
    }
    return scheduled
  }

  if (!environment.IntersectionObserver) {
    mountOnce()
    return scheduled
  }

  const observer = new environment.IntersectionObserver((entries) => {
    if (finished || !entries.some((entry) => entry.isIntersecting)) return
    mountOnce()
  }, { rootMargin: '200px' })
  cancelPending = () => observer.disconnect()
  for (const target of visibilityTargets(element)) observer.observe(target)
  return scheduled
}

/**
 * @deprecated aliases kept so island-side hydration terminology still resolves.
 * Prefer the `ClientMount*` names above.
 */
export {
  scheduleClientMount as scheduleHydration,
  type ClientMountEnvironment as HydrationEnvironment,
  type ScheduledClientMount as ScheduledHydration,
}
