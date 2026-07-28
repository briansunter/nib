import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { defineClientBehavior } from '../src/framework/behaviors'
import { renderReactPage } from '../src/framework/render-page'
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
  it('lets prop-free behaviors omit redundant props and hydration defaults', () => {
    const Reveal = defineClientBehavior('reveal')
    const rendered = renderReactPage(<Reveal />)

    expect(rendered.behaviors).toEqual(['reveal'])
    expect(rendered.html).toContain('data-hydrate="load"')
    expect(rendered.html).toContain('data-props="{}"')
    expect(rendered.html).toContain('style="display:contents"')
  })

  it('does not mistake marker text inside a script for a behavior', () => {
    const rendered = renderReactPage(
      <script dangerouslySetInnerHTML={{
        __html: 'const example = `<nib-behavior data-behavior="fake"></nib-behavior>`',
      }} />,
    )

    expect(rendered.behaviors).toEqual([])
  })

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
      default: defineBehaviorClient(mount),
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
        default: defineBehaviorClient(mount),
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

  it('cleans a marker detached during module loading and permits remount', async () => {
    let resolveModule!: (module: {
      default: ReturnType<typeof defineBehaviorClient>
    }) => void
    const mount = vi.fn()
    const load = vi.fn(() => new Promise<{
      default: ReturnType<typeof defineBehaviorClient>
    }>((resolve) => {
      resolveModule = resolve
    }))
    const element = behaviorElement({
      behavior: 'reveal',
      hydrate: 'load',
      props: '{}',
    })
    const elements = [element]
    const root = rootWith(elements)
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': load,
    }, {
      environment: { setTimeout: vi.fn(() => 1) },
    })

    runtime.mount(root)
    elements.pop()
    resolveModule({ default: defineBehaviorClient(mount) })
    await vi.waitFor(() => expect(element.dataset.scheduled).toBeUndefined())
    expect(mount).not.toHaveBeenCalled()

    elements.push(element)
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    expect(load).toHaveBeenCalledOnce()
  })

  it('cleans a marker detached during async mount and permits remount', async () => {
    let resolveMount!: (cleanup: () => void) => void
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    const mount = vi.fn()
      .mockImplementationOnce(() => new Promise<() => void>((resolve) => {
        resolveMount = resolve
      }))
      .mockReturnValueOnce(secondCleanup)
    const element = behaviorElement({
      behavior: 'reveal',
      hydrate: 'load',
      props: '{}',
    })
    const elements = [element]
    const root = rootWith(elements)
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({
        default: defineBehaviorClient(mount),
      }),
    }, {
      environment: { setTimeout: vi.fn(() => 1) },
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    elements.pop()
    resolveMount(firstCleanup)
    await vi.waitFor(() => expect(firstCleanup).toHaveBeenCalledOnce())
    expect(element.dataset.scheduled).toBeUndefined()
    expect(mount.mock.calls[0]![0].signal.aborted).toBe(true)

    elements.push(element)
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))
    runtime.unmount(root)
    expect(secondCleanup).toHaveBeenCalledOnce()
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
        default: defineBehaviorClient(mount),
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
        default: defineBehaviorClient(mount),
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

  it('clears failed loads so a later mount can retry', async () => {
    const mount = vi.fn()
    const reportError = vi.fn()
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('temporary chunk failure'))
      .mockResolvedValue({ default: defineBehaviorClient(mount) })
    const element = behaviorElement({
      behavior: 'reveal',
      hydrate: 'load',
      props: '{}',
    })
    const root = rootWith([element])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': load,
    }, {
      reportError,
      environment: { setTimeout: vi.fn(() => 1) },
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
    expect(element.dataset.scheduled).toBeUndefined()
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('rejects duplicate filename-derived IDs', () => {
    expect(() => createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({ default: null }),
      './src/behaviors/reveal.client.ts': async () => ({ default: null }),
    })).toThrow('Duplicate behavior ID')
  })
})
