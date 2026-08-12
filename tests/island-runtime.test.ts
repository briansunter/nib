import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  hydrateIsland,
  type IslandHydrateRootOptions,
} from '../src/framework/island-runtime'
import {
  islandVisibilityTargets,
  scheduleIslandHydration,
} from '../src/framework/island-scheduler'
import { island } from '../src/framework/islands'
import { registeredIsland } from './helpers/islands'

function element(children: Element[] = [], parentElement: Element | null = null): HTMLElement {
  return { children, parentElement } as unknown as HTMLElement
}

function islandElement(dataset: Record<string, string>): HTMLElement {
  return { dataset } as unknown as HTMLElement
}

describe('island hydration runtime', () => {
  it('hydrates load immediately', () => {
    const hydrate = vi.fn()
    scheduleIslandHydration(element(), 'load', hydrate, {})
    expect(hydrate).toHaveBeenCalledOnce()
  })

  it('observes visible island children and supports cancellation', () => {
    const first = {} as Element
    const second = {} as Element
    const parent = {} as Element
    expect(islandVisibilityTargets(element([first, second]))).toEqual([first, second])
    expect(islandVisibilityTargets(element([], parent))).toEqual([parent])

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
    const scheduled = scheduleIslandHydration(
      element([first, second]),
      'visible',
      hydrate,
      { IntersectionObserver: FakeIntersectionObserver as never },
    )
    expect(observe).toHaveBeenCalledTimes(2)
    callback?.([{ isIntersecting: false }])
    expect(hydrate).not.toHaveBeenCalled()
    scheduled.cancel()
    callback?.([{ isIntersecting: true }])
    expect(disconnect).toHaveBeenCalledOnce()
    expect(hydrate).not.toHaveBeenCalled()
  })

  it('loads, validates, parses, and hydrates an island module', async () => {
    const Counter = registeredIsland(
      'counter',
      island(({ count }: { count: number }) => (
        createElement('span', null, `Count: ${count}`)
      )),
    )
    const hydrateRoot = vi.fn((
      _element: HTMLElement,
      _content: ReactNode,
      _options: IslandHydrateRootOptions,
    ) => ({ unmount: vi.fn() }))
    const reportError = vi.fn()
    await hydrateIsland(
      islandElement({
        nibIsland: 'counter',
        nibInstance: 'nib-0',
        nibPrefix: 'nib-0-',
        nibWhen: 'load',
        nibProps: '{"count":2}',
      }),
      {
        loaders: new Map([['counter', async () => ({ default: Counter })]]),
        hydrateRoot,
        reportError,
      },
    )

    expect(hydrateRoot).toHaveBeenCalledOnce()
    expect(renderToString(hydrateRoot.mock.calls[0]![1])).toContain('<span>Count: 2</span>')
    const options = hydrateRoot.mock.calls[0]![2]
    expect(options.identifierPrefix).toBe('nib-0-')
    options.onRecoverableError(new Error('mismatch'))
    expect(reportError).toHaveBeenCalledWith('counter', 'nib-0', expect.any(Error))
  })

  it('rejects malformed metadata and definition strategy drift', async () => {
    const dependencies = {
      loaders: new Map<string, () => Promise<{ default: unknown }>>(),
      hydrateRoot: vi.fn(),
    }
    await expect(hydrateIsland(islandElement({}), dependencies))
      .rejects.toThrow('valid hydration metadata')

    const Counter = registeredIsland(
      'counter',
      island(() => null, { when: 'visible' }),
    )
    dependencies.loaders.set('counter', async () => ({ default: Counter }))
    await expect(hydrateIsland(islandElement({
      nibIsland: 'counter',
      nibInstance: 'nib-0',
      nibPrefix: 'nib-0-',
      nibWhen: 'load',
      nibProps: '{}',
    }), dependencies)).rejects.toThrow('strategy mismatch')
  })
})
