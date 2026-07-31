import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Behavior } from '../src/framework/behaviors'
import { behaviorFileToId } from '../src/framework/behavior-paths'
import { island } from '../src/framework/islands'
import { renderReactPage } from '../src/framework/render-page'
import {
  createBehaviorRuntime,
  type ClientBehavior,
} from '../src/runtime/behaviors'
import { registeredIsland } from './helpers/islands'

function behaviorElement(
  dataset: Record<string, string>,
): HTMLElement {
  return { dataset, children: [], parentElement: null } as unknown as HTMLElement
}

function rootWith(elements: HTMLElement[]): ParentNode {
  return {
    querySelectorAll: (selector: string) => (
      selector === '[data-nib-behavior]'
        ? elements.filter((element) => element.dataset.nibBehavior !== undefined)
        : []
    ),
    contains: (element: Node) => elements.includes(element as HTMLElement),
  } as unknown as ParentNode
}

describe('client behaviors', () => {
  it('maps one declarative boundary directly to a client module', () => {
    const rendered = renderReactPage(
      <Behavior name="filters/search" defer="visible">
        <button>Filter</button>
      </Behavior>,
    )

    expect(rendered.behaviors).toEqual(['filters/search'])
    expect(rendered.html).toContain('data-nib-behavior="filters/search"')
    expect(rendered.html).toContain('data-nib-defer="visible"')
    expect(rendered.html).not.toContain('data-props')
    expect(rendered.html).toContain('>Filter</button>')
  })

  it('rejects invalid declarative names and defer timing', () => {
    expect(() => renderReactPage(<Behavior name="Search"><div /></Behavior>))
      .toThrow('Invalid behavior ID')
    expect(() => renderReactPage(
      <Behavior name="search" defer={'later' as 'idle'}><div /></Behavior>,
    )).toThrow('Invalid defer strategy')
  })

  it('requires a single existing DOM element as its root', () => {
    function Feature() {
      return <button>Feature</button>
    }
    expect(() => renderReactPage(
      <Behavior name="feature"><Feature /></Behavior>,
    )).toThrow('requires one existing DOM element child')
  })

  it('rejects absent, multiple, and same-element behavior roots', () => {
    expect(() => renderReactPage(
      <Behavior name="feature" children={null as never} />,
    )).toThrow()
    expect(() => renderReactPage(
      <Behavior
        name="feature"
        children={[<div key="one" />, <div key="two" />] as never}
      />,
    )).toThrow()
    expect(() => renderReactPage(
      <Behavior name="feature"><div data-nib-behavior="existing" /></Behavior>,
    )).toThrow('cannot share an element with another behavior')
  })

  it('allows sibling behaviors and islands but rejects overlapping ownership', () => {
    const Counter = registeredIsland(
      'counter',
      island(() => <button>Count</button>),
    )
    const siblings = renderReactPage(
      <main>
        <Behavior name="reveal"><p>Details</p></Behavior>
        <Counter />
      </main>,
    )
    expect(siblings.behaviors).toEqual(['reveal'])
    expect(siblings.islands).toEqual(['counter'])

    expect(() => renderReactPage(
      <Behavior name="reveal"><Counter /></Behavior>,
    )).toThrow(
      'island "counter" cannot be nested inside behavior "reveal"',
    )
    const nested = renderReactPage(
      <Behavior name="outer">
        <article>
          <Behavior name="inner"><button>Inner</button></Behavior>
        </article>
      </Behavior>,
    )
    expect(nested.behaviors).toEqual(['outer', 'inner'])
    expect(nested.html).toContain('data-nib-behavior="outer"')
    expect(nested.html).toContain('data-nib-behavior="inner"')

    const Conflicted = registeredIsland(
      'conflicted',
      island(() => (
        <Behavior name="reveal"><p>Details</p></Behavior>
      )),
    )
    expect(() => renderReactPage(<Conflicted />)).toThrow(
      'behavior "reveal" cannot be nested inside island "conflicted"',
    )
  })

  it('mounts behaviors immediately by default (no activation timing)', () => {
    const rendered = renderReactPage(<Behavior name="reveal"><div>Details</div></Behavior>)

    expect(rendered.behaviors).toEqual(['reveal'])
    expect(rendered.html).not.toContain('data-nib-defer')
    expect(rendered.html).not.toContain('data-props')
  })

  it('Behavior defers mounting until the strategy fires', () => {
    const rendered = renderReactPage(
      <Behavior name="travel-map" defer="visible">
        <div>Map</div>
      </Behavior>,
    )

    expect(rendered.behaviors).toEqual(['travel-map'])
    expect(rendered.html).toContain('data-nib-behavior="travel-map"')
    expect(rendered.html).toContain('data-nib-defer="visible"')
  })

  it('derives readable ids only for src/behaviors modules', () => {
    expect(behaviorFileToId('/src/behaviors/search.client.ts')).toBe('search')
    expect(behaviorFileToId('/src/behaviors/filters/search.client.ts')).toBe('filters/search')
    expect(() => behaviorFileToId('/src/components/CopyButton.client.ts'))
      .toThrow('must be under src/behaviors')
  })

  it('does not mistake marker text inside a script for a behavior', () => {
    const rendered = renderReactPage(
      <script dangerouslySetInnerHTML={{
        __html: 'const example = `<div data-nib-behavior="fake"></div>`',
      }} />,
    )

    expect(rendered.behaviors).toEqual([])
  })

  it('renders server content without a props payload', () => {
    const html = renderToStaticMarkup(
      <Behavior name="reveal" defer="visible">
        <button>Details</button>
      </Behavior>,
    )
    expect(html).toContain('data-nib-behavior="reveal"')
    expect(html).toContain('data-nib-defer="visible"')
    expect(html).not.toContain('data-props')
    expect(html).toContain('>Details</button>')
  })

  it('mounts a behavior with no strategy immediately', async () => {
    const mount = vi.fn()
    const element = behaviorElement({ nibBehavior: 'reveal' })
    const root = rootWith([element])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({ default: mount }),
    }, {
      environment: { setTimeout: vi.fn(() => 1) },
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    runtime.unmount(root)
    expect(mount.mock.calls[0]![0].signal.aborted).toBe(true)
  })

  it('loads a module once and cleans each mounted root exactly once', async () => {
    const cleanup = vi.fn()
    const mount = vi.fn((context: { signal: AbortSignal }) => {
      context.signal.addEventListener('abort', cleanup, { once: true })
    })
    const load = vi.fn(async () => ({
      default: mount,
    }))
    const first = behaviorElement({
      nibBehavior: 'reveal',
    })
    const second = behaviorElement({
      nibBehavior: 'reveal',
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

  it('gives nested canonical behaviors independent abort lifetimes', async () => {
    const mounts = vi.fn()
    const teardowns = [vi.fn(), vi.fn()]
    let index = 0
    const mount = vi.fn((context: { signal: AbortSignal }) => {
      const teardown = teardowns[index++]!
      context.signal.addEventListener('abort', teardown, { once: true })
      mounts(context)
    })
    const outer = behaviorElement({ nibBehavior: 'outer' })
    const inner = behaviorElement({ nibBehavior: 'inner' })
    const root = rootWith([outer, inner])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/outer.client.ts': async () => ({ default: mount }),
      '/src/behaviors/inner.client.ts': async () => ({ default: mount }),
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(mounts).toHaveBeenCalledTimes(2))
    expect(mounts.mock.calls[0]![0].signal).not.toBe(mounts.mock.calls[1]![0].signal)
    runtime.unmount(root)
    runtime.unmount(root)
    expect(teardowns[0]).toHaveBeenCalledOnce()
    expect(teardowns[1]).toHaveBeenCalledOnce()
  })

  it('accepts plain default-exported mount functions', async () => {
    const plainMount = vi.fn()
    const typedMount = vi.fn()
    const plain = behaviorElement({
      nibBehavior: 'plain',
    })
    const typed = behaviorElement({
      nibBehavior: 'typed',
    })
    const root = rootWith([plain, typed])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/plain.client.js': async () => ({
        default: plainMount,
      }),
      '/src/behaviors/typed.client.ts': async () => ({
        default: typedMount,
      }),
    }, {
      environment: { setTimeout: vi.fn(() => 1) },
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(plainMount).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(typedMount).toHaveBeenCalledOnce())
  })

  it('cancels pending idle work before a root is detached', () => {
    let idle: (() => void) | undefined
    const cancelIdleCallback = vi.fn()
    const mount = vi.fn()
    const element = behaviorElement({
      nibBehavior: 'reveal',
      nibDefer: 'idle',
    })
    const root = rootWith([element])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({
        default: mount,
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
      default: ClientBehavior
    }) => void
    const mount = vi.fn()
    const load = vi.fn(() => new Promise<{
      default: ClientBehavior
    }>((resolve) => {
      resolveModule = resolve
    }))
    const element = behaviorElement({
      nibBehavior: 'reveal',
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
    resolveModule({ default: mount })
    await vi.waitFor(() => expect(element.dataset.scheduled).toBeUndefined())
    expect(mount).not.toHaveBeenCalled()

    elements.push(element)
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    expect(load).toHaveBeenCalledOnce()
  })

  it('cleans a marker detached during async mount and permits remount', async () => {
    let resolveMount!: () => void
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    const mount = vi.fn()
      .mockImplementationOnce((context: { signal: AbortSignal }) => {
        context.signal.addEventListener('abort', firstCleanup, { once: true })
        return new Promise<void>((resolve) => {
          resolveMount = resolve
        })
      })
      .mockImplementationOnce((context: { signal: AbortSignal }) => {
        context.signal.addEventListener('abort', secondCleanup, { once: true })
      })
    const element = behaviorElement({
      nibBehavior: 'reveal',
    })
    const elements = [element]
    const root = rootWith(elements)
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({
        default: mount,
      }),
    }, {
      environment: { setTimeout: vi.fn(() => 1) },
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    elements.pop()
    resolveMount()
    await vi.waitFor(() => expect(firstCleanup).toHaveBeenCalledOnce())
    expect(element.dataset.scheduled).toBeUndefined()
    expect(mount.mock.calls[0]![0].signal.aborted).toBe(true)

    elements.push(element)
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))
    runtime.unmount(root)
    expect(secondCleanup).toHaveBeenCalledOnce()
  })

  it('clears bookkeeping on unmount and permits remount', async () => {
    const teardown = vi.fn()
    const mount = vi.fn().mockImplementation((context: { signal: AbortSignal }) => (
      context.signal.addEventListener('abort', teardown, { once: true })
    ))
    const element = behaviorElement({
      nibBehavior: 'reveal',
    })
    const root = rootWith([element])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({
        default: mount,
      }),
    }, {
      environment: { setTimeout: vi.fn(() => 1) },
    })
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())

    runtime.unmount(root)
    expect(element.dataset.scheduled).toBeUndefined()
    expect(teardown).toHaveBeenCalledOnce()
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))
    runtime.unmount(root)
    expect(teardown).toHaveBeenCalledTimes(2)
  })

  it('aborts every behavior signal on destroy', async () => {
    const teardowns = [vi.fn(), vi.fn()]
    let index = 0
    const mount = vi.fn().mockImplementation((context: { signal: AbortSignal }) => (
      context.signal.addEventListener('abort', teardowns[index++]!, { once: true })
    ))
    const root = rootWith([
      behaviorElement({ nibBehavior: 'reveal' }),
      behaviorElement({ nibBehavior: 'reveal' }),
    ])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal.client.ts': async () => ({
        default: mount,
      }),
    }, {
      environment: { setTimeout: vi.fn(() => 1) },
    })
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))

    // Each behavior owns its own abort signal, so destroy tears them all down.
    runtime.destroy()
    expect(teardowns[0]).toHaveBeenCalledOnce()
    expect(teardowns[1]).toHaveBeenCalledOnce()
    expect(() => runtime.destroy()).not.toThrow()
  })

  it('clears failed loads so a later mount can retry', async () => {
    const mount = vi.fn()
    const reportError = vi.fn()
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('temporary chunk failure'))
      .mockResolvedValue({ default: mount })
    const element = behaviorElement({
      nibBehavior: 'reveal',
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
