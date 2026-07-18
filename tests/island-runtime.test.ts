import { describe, expect, it, vi } from 'vitest'
import {
  hydrateIsland,
  scheduleHydration,
  visibilityTargets,
  type IslandHydrationEnvironment,
} from '../src/framework/island-runtime'
import { defineIsland } from '../src/framework/islands'

function element(children: Element[] = [], parentElement: Element | null = null): HTMLElement {
  return { children, parentElement } as unknown as HTMLElement
}

function islandElement(dataset: Record<string, string>): HTMLElement {
  return { dataset } as unknown as HTMLElement
}

function environment(overrides: Partial<IslandHydrationEnvironment> = {}): IslandHydrationEnvironment {
  return {
    setTimeout: vi.fn(() => 1),
    ...overrides,
  }
}

describe('island hydration runtime', () => {
  it('hydrates immediately for load and once for repeated callbacks', () => {
    const hydrate = vi.fn()
    scheduleHydration(element(), 'load', hydrate, environment())
    expect(hydrate).toHaveBeenCalledOnce()
  })

  it('schedules idle hydration with the browser idle callback or timer fallback', () => {
    const idle = vi.fn()
    const hydrate = vi.fn()
    scheduleHydration(element(), 'idle', hydrate, environment({ requestIdleCallback: idle }))
    expect(idle).toHaveBeenCalledOnce()
    expect(hydrate).not.toHaveBeenCalled()
    idle.mock.calls[0][0]()
    expect(hydrate).toHaveBeenCalledOnce()

    const fallbackHydrate = vi.fn()
    const setTimeout = vi.fn((callback: () => void) => {
      callback()
      return 1
    })
    scheduleHydration(element(), 'idle', fallbackHydrate, environment({ setTimeout }))
    expect(fallbackHydrate).toHaveBeenCalledOnce()
  })

  it('observes every child for visible hydration and falls back to the parent', () => {
    const first = {} as Element
    const second = {} as Element
    expect(visibilityTargets(element([first, second]))).toEqual([first, second])
    const parent = {} as Element
    expect(visibilityTargets(element([], parent))).toEqual([parent])

    const observe = vi.fn()
    const disconnect = vi.fn()
    let callback: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined
    class FakeIntersectionObserver {
      constructor(next: (entries: Array<{ isIntersecting: boolean }>) => void) {
        callback = next
      }
      observe = observe
      disconnect = disconnect
    }
    const hydrate = vi.fn()
    scheduleHydration(
      element([first, second]),
      'visible',
      hydrate,
      environment({ IntersectionObserver: FakeIntersectionObserver as unknown as typeof window.IntersectionObserver }),
    )
    expect(observe).toHaveBeenNthCalledWith(1, first)
    expect(observe).toHaveBeenNthCalledWith(2, second)
    callback?.([{ isIntersecting: false }])
    expect(hydrate).not.toHaveBeenCalled()
    callback?.([{ isIntersecting: true }, { isIntersecting: true }])
    callback?.([{ isIntersecting: true }])
    expect(disconnect).toHaveBeenCalledOnce()
    expect(hydrate).toHaveBeenCalledOnce()
  })

  it('hydrates immediately when IntersectionObserver is unavailable', () => {
    const hydrate = vi.fn()
    scheduleHydration(element(), 'visible', hydrate, environment())
    expect(hydrate).toHaveBeenCalledOnce()
  })

  it('loads, validates, parses, and hydrates an island module', async () => {
    const Counter = defineIsland('counter', ({ count: _count }: { count: number }) => null)
    const hydrateRoot = vi.fn()
    const reportError = vi.fn()
    await hydrateIsland(
      islandElement({
        island: 'counter',
        instance: 'nib-0',
        prefix: 'nib-0-',
        props: '{"count":2}',
      }),
      {
        loaders: new Map([['counter', async () => ({ default: Counter })]]),
        hydrateRoot,
        reportError,
      },
    )

    expect(hydrateRoot).toHaveBeenCalledOnce()
    const options = hydrateRoot.mock.calls[0][2]
    expect(options.identifierPrefix).toBe('nib-0-')
    options.onRecoverableError(new Error('mismatch'))
    expect(reportError).toHaveBeenCalledWith('counter', 'nib-0', expect.any(Error))
  })

  it('rejects missing metadata, unknown modules, and malformed props', async () => {
    const dependencies = {
      loaders: new Map<string, () => Promise<{ default: unknown }>>(),
      hydrateRoot: vi.fn(),
    }
    await expect(hydrateIsland(islandElement({}), dependencies)).rejects.toThrow('missing hydration metadata')
    await expect(hydrateIsland(
      islandElement({ island: 'missing', instance: 'nib-0', prefix: 'nib-0-', props: '{}' }),
      dependencies,
    )).rejects.toThrow('No client module found')
    dependencies.loaders.set('counter', async () => ({ default: defineIsland('counter', () => null) }))
    await expect(hydrateIsland(
      islandElement({ island: 'counter', instance: 'nib-0', prefix: 'nib-0-', props: '{' }),
      dependencies,
    )).rejects.toThrow('invalid JSON')
  })
})
