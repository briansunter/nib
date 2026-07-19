import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hydrateRoot = vi.hoisted(() => vi.fn())

vi.mock('react-dom/client', () => ({ hydrateRoot }))

import { startIslandRuntime } from '../src/runtime/client'
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
})
