import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { defineClientBehavior } from '../src/framework/behaviors'
import {
  createBehaviorRuntime,
  defineBehaviorClient,
  type BehaviorMountContext,
} from '../src/runtime/behaviors'

function behaviorElement(
  dataset: Record<string, string>,
): HTMLElement {
  return { dataset, children: [], parentElement: null } as unknown as HTMLElement
}

function rootWith(elements: HTMLElement[]): ParentNode {
  return {
    querySelectorAll: () => elements,
    contains: (element: Node) => elements.includes(element as HTMLElement),
  } as unknown as ParentNode
}

describe('client behaviors', () => {
  it('renders server content and serializes validated props', () => {
    const Reveal = defineClientBehavior<{ label: string }>('reveal')
    const html = renderToStaticMarkup(
      <Reveal props={{ label: 'Details' }} hydrate="visible">
        <button>Details</button>
      </Reveal>,
    )
    expect(html).toContain('<nib-behavior')
    expect(html).toContain('data-behavior="reveal"')
    expect(html).toContain('data-hydrate="visible"')
    expect(html).toContain('<button>Details</button>')
  })

  it('loads a module once and cleans each mounted root exactly once', async () => {
    const cleanup = vi.fn()
    const mount = vi.fn((_context: BehaviorMountContext<{ label: string }>) => cleanup)
    const load = vi.fn(async () => ({
      default: defineBehaviorClient('reveal', mount),
    }))
    const first = behaviorElement({
      behavior: 'reveal',
      hydrate: 'load',
      props: '{"label":"First"}',
    })
    const second = behaviorElement({
      behavior: 'reveal',
      hydrate: 'load',
      props: '{"label":"Second"}',
    })
    const root = rootWith([first, second])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': load,
    }, {
      environment: { setTimeout: vi.fn(() => 1) },
    })
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))
    expect(load).toHaveBeenCalledOnce()
    runtime.unmount(root)
    runtime.unmount(root)
    expect(cleanup).toHaveBeenCalledTimes(2)
    expect(mount.mock.calls[0]![0].signal.aborted).toBe(true)
  })

  it('cancels pending idle work before a root is detached', () => {
    let idle: (() => void) | undefined
    const cancelIdleCallback = vi.fn()
    const mount = vi.fn()
    const element = behaviorElement({
      behavior: 'reveal',
      hydrate: 'idle',
      props: '{}',
    })
    const root = rootWith([element])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({
        default: defineBehaviorClient('reveal', mount),
      }),
    }, {
      environment: {
        requestIdleCallback(callback) {
          idle = callback
          return 7
        },
        cancelIdleCallback,
        setTimeout: vi.fn(),
      },
    })
    runtime.mount(root)
    runtime.unmount(root)
    idle?.()
    expect(cancelIdleCallback).toHaveBeenCalledWith(7)
    expect(mount).not.toHaveBeenCalled()
  })

  it('clears bookkeeping before a throwing cleanup and can remount', async () => {
    const throwingCleanup = vi.fn(() => {
      throw new Error('application cleanup failed')
    })
    const successfulCleanup = vi.fn()
    const mount = vi.fn()
      .mockReturnValueOnce(throwingCleanup)
      .mockReturnValueOnce(successfulCleanup)
    const element = behaviorElement({
      behavior: 'reveal',
      hydrate: 'load',
      props: '{}',
    })
    const root = rootWith([element])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({
        default: defineBehaviorClient('reveal', mount),
      }),
    }, {
      environment: { setTimeout: vi.fn(() => 1) },
    })
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())

    expect(() => runtime.unmount(root)).toThrow(AggregateError)
    expect(element.dataset.scheduled).toBeUndefined()
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))
    runtime.unmount(root)

    expect(throwingCleanup).toHaveBeenCalledOnce()
    expect(successfulCleanup).toHaveBeenCalledOnce()
  })

  it('attempts cleanup for every behavior when one callback throws', async () => {
    const secondCleanup = vi.fn()
    const mount = vi.fn()
      .mockReturnValueOnce(() => {
        throw new Error('first failed')
      })
      .mockReturnValueOnce(secondCleanup)
    const root = rootWith([
      behaviorElement({ behavior: 'reveal', hydrate: 'load', props: '{}' }),
      behaviorElement({ behavior: 'reveal', hydrate: 'load', props: '{}' }),
    ])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({
        default: defineBehaviorClient('reveal', mount),
      }),
    }, {
      environment: { setTimeout: vi.fn(() => 1) },
    })
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))

    expect(() => runtime.destroy()).toThrow(AggregateError)
    expect(secondCleanup).toHaveBeenCalledOnce()
    expect(() => runtime.destroy()).not.toThrow()
  })

  it('rejects duplicate IDs and mismatched modules', async () => {
    expect(() => createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({ default: null }),
      './src/behaviors/reveal.client.ts': async () => ({ default: null }),
    })).toThrow('Duplicate behavior ID')

    const reportError = vi.fn()
    const element = behaviorElement({
      behavior: 'reveal',
      hydrate: 'load',
      props: '{}',
    })
    createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({
        default: defineBehaviorClient('other', () => {}),
      }),
    }, {
      reportError,
      environment: { setTimeout: vi.fn(() => 1) },
    }).mount(rootWith([element]))
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledWith(
      'reveal',
      expect.objectContaining({ message: expect.stringContaining('ID mismatch') }),
    ))
  })
})
