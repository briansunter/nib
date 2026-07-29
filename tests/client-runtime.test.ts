import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hydrateRoot = vi.hoisted(() => vi.fn())

vi.mock('react-dom/client', () => ({ hydrateRoot }))

import { createIslandRuntime } from '../src/runtime/client'
import { island, type IslandDefinition } from '../src/framework/islands'

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
    const Counter = island(({ count: _count }: { count: number }) => null)
    const element = islandElement({
      hydrate: 'load',
      island: 'counter',
      instance: 'nib-0',
      prefix: 'nib-0-',
      props: '{"count":1}',
    })

    const runtime = createIslandRuntime({
      '/src/islands/counter.tsx': async () => ({ default: Counter }),
    })
    runtime.mount(rootWith([element, element]))

    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledOnce())
    expect(element.dataset.scheduled).toBe('true')
  })

  it('shares one in-flight module load across island instances', async () => {
    const Counter = island(() => null)
    const load = vi.fn(async () => ({ default: Counter }))
    const first = islandElement({
      hydrate: 'load',
      island: 'counter',
      instance: 'nib-0',
      prefix: 'nib-0-',
      props: '{}',
    })
    const second = islandElement({
      hydrate: 'load',
      island: 'counter',
      instance: 'nib-1',
      prefix: 'nib-1-',
      props: '{}',
    })

    createIslandRuntime({
      '/src/islands/counter.tsx': load,
    }).mount(rootWith([first, second]))

    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledTimes(2))
    expect(load).toHaveBeenCalledOnce()
  })

  it('rejects duplicate IDs and reports invalid hydration metadata', () => {
    expect(() => createIslandRuntime({
      './src/islands/counter.tsx': async () => ({ default: null }),
      '/src/islands/counter.tsx': async () => ({ default: null }),
    })).toThrow('Duplicate island ID: counter')

    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    const element = islandElement({
      hydrate: 'later',
      island: 'counter',
      instance: 'nib-0',
      props: '{}',
    })
    createIslandRuntime({}).mount(rootWith([element]))
    expect(report).toHaveBeenCalledWith(
      'Failed to hydrate island counter (nib-0)',
      expect.any(Error),
    )
    const missing = islandElement({
      hydrate: 'load',
      island: 'missing',
      instance: 'nib-1',
      prefix: 'nib-1-',
      props: '{}',
    })
    createIslandRuntime({}).mount(rootWith([missing]))
    expect(report).toHaveBeenCalledWith(
      'Failed to hydrate island missing (nib-1)',
      expect.objectContaining({ message: 'No client module found for island missing' }),
    )
    expect(missing.dataset.scheduled).toBeUndefined()
    expect(hydrateRoot).not.toHaveBeenCalled()
    report.mockRestore()
  })

  it('unmounts hydrated roots once and cancels detached pending work', async () => {
    const Counter = island(() => null)
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

  it('does not hydrate after an in-flight module load is unmounted', async () => {
    let resolveModule: ((module: { default: IslandDefinition<any> }) => void) | undefined
    const loading = new Promise<{ default: IslandDefinition<any> }>((resolve) => {
      resolveModule = resolve
    })
    const element = islandElement({
      hydrate: 'load',
      island: 'counter',
      instance: 'nib-0',
      prefix: 'nib-0-',
      props: '{}',
    })
    const root = rootWith([element])
    const runtime = createIslandRuntime({
      '/src/islands/counter.tsx': () => loading,
    })

    runtime.mount(root)
    runtime.unmount(root)
    resolveModule?.({ default: island(() => null) })
    await loading
    await Promise.resolve()

    expect(hydrateRoot).not.toHaveBeenCalled()
  })

  it('does not hydrate a root detached during its module load', async () => {
    let attached = true
    let resolveModule: ((module: { default: IslandDefinition<any> }) => void) | undefined
    const loading = new Promise<{ default: IslandDefinition<any> }>((resolve) => {
      resolveModule = resolve
    })
    const load = vi.fn(() => loading)
    const reportError = vi.fn()
    const element = islandElement({
      hydrate: 'load',
      island: 'counter',
      instance: 'nib-0',
      prefix: 'nib-0-',
      props: '{}',
    })
    const root = {
      contains: () => attached,
      querySelectorAll: () => [element],
    } as unknown as ParentNode
    const runtime = createIslandRuntime({
      '/src/islands/counter.tsx': load,
    }, { reportError })

    runtime.mount(root)
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    attached = false
    resolveModule?.({ default: island(() => null) })
    await loading
    await vi.waitFor(() => expect(element.dataset.scheduled).toBeUndefined())

    expect(hydrateRoot).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('clears a rejected loader so a later mount can retry', async () => {
    const Counter = island(() => null)
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('temporary chunk failure'))
      .mockResolvedValueOnce({ default: Counter })
    const reportError = vi.fn()
    const element = islandElement({
      hydrate: 'load',
      island: 'counter',
      instance: 'nib-0',
      prefix: 'nib-0-',
      props: '{}',
    })
    const root = rootWith([element])
    const runtime = createIslandRuntime({
      '/src/islands/counter.tsx': load,
    }, { reportError })

    runtime.mount(root)
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
    expect(element.dataset.scheduled).toBeUndefined()

    runtime.mount(root)
    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledOnce())
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('clears island bookkeeping even when React cleanup throws', async () => {
    const element = islandElement({
      hydrate: 'load',
      island: 'counter',
      instance: 'nib-0',
      prefix: 'nib-0-',
      props: '{}',
    })
    const root = rootWith([element])
    const firstUnmount = vi.fn(() => {
      throw new Error('React cleanup failed')
    })
    const secondUnmount = vi.fn()
    hydrateRoot
      .mockReturnValueOnce({ unmount: firstUnmount })
      .mockReturnValueOnce({ unmount: secondUnmount })
    const Counter = island(() => null)
    const runtime = createIslandRuntime({
      '/src/islands/counter.tsx': async () => ({ default: Counter }),
    })
    runtime.mount(root)
    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledOnce())

    expect(() => runtime.unmount(root)).toThrow(AggregateError)
    runtime.mount(root)
    await vi.waitFor(() => expect(hydrateRoot).toHaveBeenCalledTimes(2))
    runtime.unmount(root)

    expect(firstUnmount).toHaveBeenCalledOnce()
    expect(secondUnmount).toHaveBeenCalledOnce()
  })
})
