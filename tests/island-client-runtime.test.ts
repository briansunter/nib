import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hydrateRoot = vi.hoisted(() => vi.fn())

vi.mock('react-dom/client', () => ({ hydrateRoot }))

import { island } from '../src/framework/islands'
import { createIslandRuntime } from '../src/runtime/islands'

function rootWith(elements: HTMLElement[]): Document {
  return {
    querySelectorAll: () => elements,
  } as unknown as Document
}

function islandElement(dataset: Record<string, string>): HTMLElement {
  return { children: [], dataset, parentElement: null } as unknown as HTMLElement
}

beforeEach(() => {
  hydrateRoot.mockReset()
  hydrateRoot.mockReturnValue({ unmount: vi.fn() })
  vi.stubGlobal('window', {})
})

afterEach(() => vi.unstubAllGlobals())

describe('island client entry', () => {
  it('hydrates a discovered load island once and memoizes its module', async () => {
    const Counter = island(({ count: _count }: { count: number }) => null)
    const load = vi.fn(async () => ({ default: Counter }))
    const first = islandElement({
      nibWhen: 'load',
      nibIsland: 'counter',
      nibInstance: 'nib-0',
      nibPrefix: 'nib-0-',
      nibProps: '{"count":1}',
    })
    const second = islandElement({
      nibWhen: 'load',
      nibIsland: 'counter',
      nibInstance: 'nib-1',
      nibPrefix: 'nib-1-',
      nibProps: '{"count":2}',
    })
    const root = rootWith([first, second])
    const runtime = createIslandRuntime({ '/src/islands/counter.tsx': load })

    runtime.mount(root)
    runtime.mount(root)

    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledTimes(2))
    expect(load).toHaveBeenCalledOnce()
  })

  it('reports invalid metadata without loading a module', () => {
    const reportError = vi.fn()
    const runtime = createIslandRuntime({}, { reportError })
    runtime.mount(rootWith([islandElement({
      nibWhen: 'idle',
      nibIsland: 'counter',
      nibInstance: 'nib-0',
      nibPrefix: 'nib-0-',
      nibProps: '{}',
    })]))

    expect(reportError).toHaveBeenCalledWith(
      'counter',
      'nib-0',
      expect.objectContaining({ message: expect.stringContaining('Invalid island') }),
    )
    expect(hydrateRoot).not.toHaveBeenCalled()
  })

  it('hydrates a visible island only after it intersects', async () => {
    const Counter = island(() => null, { when: 'visible' })
    const load = vi.fn(async () => ({ default: Counter }))
    let callback: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined
    class FakeIntersectionObserver {
      constructor(next: (entries: Array<{ isIntersecting: boolean }>) => void) {
        callback = next
      }
      observe = vi.fn()
      disconnect = vi.fn()
    }
    const runtime = createIslandRuntime({
      '/src/islands/counter.tsx': load,
    }, {
      environment: { IntersectionObserver: FakeIntersectionObserver as never },
    })
    runtime.mount(rootWith([islandElement({
      nibWhen: 'visible',
      nibIsland: 'counter',
      nibInstance: 'nib-0',
      nibPrefix: 'nib-0-',
      nibProps: '{}',
    })]))

    expect(load).not.toHaveBeenCalled()
    callback?.([{ isIntersecting: true }])
    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledOnce())
    expect(load).toHaveBeenCalledOnce()
  })

  it('cancels pending visible hydration when destroyed', () => {
    const Counter = island(() => null, { when: 'visible' })
    let callback: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined
    const disconnect = vi.fn()
    class FakeIntersectionObserver {
      constructor(next: (entries: Array<{ isIntersecting: boolean }>) => void) {
        callback = next
      }
      observe = vi.fn()
      disconnect = disconnect
    }
    const runtime = createIslandRuntime({
      '/src/islands/counter.tsx': async () => ({ default: Counter }),
    }, {
      environment: { IntersectionObserver: FakeIntersectionObserver as never },
    })
    runtime.mount(rootWith([islandElement({
      nibWhen: 'visible',
      nibIsland: 'counter',
      nibInstance: 'nib-0',
      nibPrefix: 'nib-0-',
      nibProps: '{}',
    })]))

    runtime.destroy()
    callback?.([{ isIntersecting: true }])

    expect(disconnect).toHaveBeenCalledOnce()
    expect(hydrateRoot).not.toHaveBeenCalled()
  })
})
