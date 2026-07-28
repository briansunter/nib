import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hydrateRoot = vi.hoisted(() => vi.fn())

vi.mock('react-dom/client', () => ({ hydrateRoot }))

import { createIslandRuntime, startIslandRuntime } from '../src/runtime/client'
import { defineIsland } from '../src/framework/islands'

function rootWith(elements: HTMLElement[]): Document {
  return {
    querySelectorAll: () => elements,
  } as unknown as Document
}

function islandElement(dataset: Record<string, string>): HTMLElement {
  return { dataset } as unknown as HTMLElement
}

beforeEach(() => {
  hydrateRoot.mockReset()
  hydrateRoot.mockReturnValue({ unmount: vi.fn() })
  vi.stubGlobal('window', {})
})

afterEach(() => vi.unstubAllGlobals())

describe('island client entry', () => {
  it('discovers a consumer module and hydrates a valid island once', async () => {
    const Counter = defineIsland('counter', ({ count: _count }: { count: number }) => null)
    const element = islandElement({
      hydrate: 'load',
      island: 'counter',
      instance: 'nib-0',
      prefix: 'nib-0-',
      props: '{"count":1}',
    })

    startIslandRuntime({
      '/src/islands/counter.tsx': async () => ({ default: Counter }),
    }, rootWith([element, element]))

    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledOnce())
    expect(element.dataset.scheduled).toBe('true')
  })

  it('rejects duplicate IDs and reports invalid hydration metadata', () => {
    expect(() => startIslandRuntime({
      './src/islands/counter.tsx': async () => ({ default: null }),
      '/src/islands/counter.tsx': async () => ({ default: null }),
    }, rootWith([]))).toThrow('Duplicate island ID: counter')

    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const element = islandElement({
      hydrate: 'later',
      island: 'counter',
      instance: 'nib-0',
      props: '{}',
    })
    startIslandRuntime({}, rootWith([element]))
    expect(report).toHaveBeenCalledWith(
      'Failed to hydrate island counter (nib-0)',
      expect.any(Error),
    )
    report.mockRestore()
  })

  it('unmounts hydrated roots once and cancels detached pending work', async () => {
    const Counter = defineIsland('counter', () => null)
    const immediate = islandElement({
      hydrate: 'load',
      island: 'counter',
      instance: 'nib-0',
      prefix: 'nib-0-',
      props: '{}',
    })
    const root = rootWith([immediate])
    const unmount = vi.fn()
    hydrateRoot.mockReturnValue({ unmount })
    const runtime = createIslandRuntime({
      '/src/islands/counter.tsx': async () => ({ default: Counter }),
    })
    runtime.mount(root)
    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledOnce())
    runtime.unmount(root)
    runtime.unmount(root)
    expect(unmount).toHaveBeenCalledOnce()

    let idle: (() => void) | undefined
    const pending = islandElement({
      hydrate: 'idle',
      island: 'counter',
      instance: 'nib-1',
      prefix: 'nib-1-',
      props: '{}',
    })
    const pendingRoot = rootWith([pending])
    const cancelIdleCallback = vi.fn()
    const pendingRuntime = createIslandRuntime({
      '/src/islands/counter.tsx': async () => ({ default: Counter }),
    }, {
      environment: {
        requestIdleCallback(callback) {
          idle = callback
          return 11
        },
        cancelIdleCallback,
        setTimeout: vi.fn(),
      },
    })
    pendingRuntime.mount(pendingRoot)
    pendingRuntime.unmount(pendingRoot)
    idle?.()
    expect(cancelIdleCallback).toHaveBeenCalledWith(11)
    expect(hydrateRoot).toHaveBeenCalledOnce()
  })
})
