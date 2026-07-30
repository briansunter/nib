import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Behavior, Enhance, LazyBehavior } from '../src/framework/behaviors'
import { behaviorFileToId } from '../src/framework/behavior-paths'
import { island } from '../src/framework/islands'
import { renderReactPage } from '../src/framework/render-page'
import {
  behavior,
  createBehaviorRuntime,
  type BehaviorMount,
  type BehaviorMountContext,
} from '../src/runtime/behaviors'
import { registeredIsland } from './helpers/islands'

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
  it('maps one declarative boundary directly to a client module', () => {
    const rendered = renderReactPage(
      <Behavior name="filters/search" when="visible" props={{ count: 2 }}>
        <button>Filter</button>
      </Behavior>,
    )

    expect(rendered.behaviors).toEqual(['filters/search'])
    expect(rendered.html).toContain('data-behavior="filters/search"')
    expect(rendered.html).toContain('data-hydrate="visible"')
    expect(rendered.html).toContain('data-props="{&quot;count&quot;:2}"')
    expect(rendered.html).toContain('<button>Filter</button>')
  })

  it('rejects invalid declarative names and activation timing', () => {
    expect(() => renderReactPage(<Behavior name="Search" />))
      .toThrow('Invalid island ID')
    expect(() => renderReactPage(
      <Behavior name="search" when={'later' as 'load'} />,
    )).toThrow('Invalid hydration strategy')
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
    expect(() => renderReactPage(
      <Behavior name="outer"><Behavior name="inner" /></Behavior>,
    )).toThrow(
      'behavior "inner" cannot be nested inside behavior "outer"',
    )

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

  it('mounts prop-free behaviors immediately by default (no activation timing)', () => {
    const rendered = renderReactPage(<Behavior name="reveal" />)

    expect(rendered.behaviors).toEqual(['reveal'])
    expect(rendered.html).not.toContain('data-hydrate')
    expect(rendered.html).toContain('data-props="{}"')
    expect(rendered.html).toContain('style="display:contents"')
  })

  it('LazyBehavior defers mounting until the strategy fires', () => {
    const rendered = renderReactPage(
      <LazyBehavior name="travel-map" when="visible">
        <div>Map</div>
      </LazyBehavior>,
    )

    expect(rendered.behaviors).toEqual(['travel-map'])
    expect(rendered.html).toContain('data-behavior="travel-map"')
    expect(rendered.html).toContain('data-hydrate="visible"')
  })

  it('Enhance places the behavior marker directly on its single child (no wrapper)', () => {
    const rendered = renderReactPage(
      <Enhance behavior="copy-button">
        <button type="button">Copy</button>
      </Enhance>,
    )

    expect(rendered.behaviors).toEqual(['copy-button'])
    expect(rendered.html).toContain('data-nib-behavior="copy-button"')
    expect(rendered.html).toContain('<button')
    expect(rendered.html).not.toContain('<nib-behavior')
    expect(rendered.html).toContain('data-props="{}"')
  })

  it('Enhance rejects nesting inside a region behavior', () => {
    expect(() => renderReactPage(
      <Behavior name="reveal">
        <Enhance behavior="copy-button"><b /></Enhance>
      </Behavior>,
    )).toThrow('cannot be nested inside')
  })

  it('derives readable ids for src/behaviors modules and stable hash ids for co-located modules', () => {
    expect(behaviorFileToId('/src/behaviors/search.client.ts')).toBe('search')
    expect(behaviorFileToId('/src/behaviors/filters/search.client.ts')).toBe('filters/search')
    const colocated = behaviorFileToId('/src/components/CopyButton.client.ts')
    expect(colocated).toMatch(/^colocated-[0-9a-f]+$/)
    // Absolute build id and glob-key form canonicalize identically.
    expect(behaviorFileToId('/Volumes/x/src/components/CopyButton.client.ts')).toBe(colocated)
  })

  it('Enhance resolves an imported module reference to its stamped id', () => {
    const rendered = renderReactPage(
      <Enhance behavior={{ __nibBehaviorId: 'colocated-deadbeef' } as const}>
        <button type="button">Copy</button>
      </Enhance>,
    )
    expect(rendered.behaviors).toEqual(['colocated-deadbeef'])
    expect(rendered.html).toContain('data-nib-behavior="colocated-deadbeef"')
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
    const html = renderToStaticMarkup(
      <Behavior name="reveal" props={{ label: 'Details' }} when="visible">
        <button>Details</button>
      </Behavior>,
    )
    expect(html).toContain('<nib-behavior')
    expect(html).toContain('data-behavior="reveal"')
    expect(html).toContain('data-hydrate="visible"')
    expect(html).toContain('<button>Details</button>')
  })

  it('mounts a behavior with no strategy immediately', async () => {
    const mount = vi.fn()
    const element = behaviorElement({ behavior: 'reveal', props: '{}' })
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
    const mount = vi.fn((context: BehaviorMountContext<{ label: string }>) => {
      context.signal.addEventListener('abort', cleanup, { once: true })
    })
    const load = vi.fn(async () => ({
      default: mount,
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

  it('accepts plain and contextually typed mount functions', async () => {
    const plainMount = vi.fn()
    const typedMount = vi.fn()
    const plain = behaviorElement({
      behavior: 'plain',
      hydrate: 'load',
      props: '{}',
    })
    const typed = behaviorElement({
      behavior: 'typed',
      hydrate: 'load',
      props: '{}',
    })
    const root = rootWith([plain, typed])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/plain.client.js': async () => ({
        default: plainMount,
      }),
      '/src/behaviors/typed.client.ts': async () => ({
        default: behavior(typedMount),
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
      behavior: 'reveal',
      hydrate: 'idle',
      props: '{}',
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
      default: BehaviorMount
    }) => void
    const mount = vi.fn()
    const load = vi.fn(() => new Promise<{
      default: BehaviorMount
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
      .mockImplementationOnce((context: BehaviorMountContext) => {
        context.signal.addEventListener('abort', firstCleanup, { once: true })
        return new Promise<void>((resolve) => {
          resolveMount = resolve
        })
      })
      .mockImplementationOnce((context: BehaviorMountContext) => {
        context.signal.addEventListener('abort', secondCleanup, { once: true })
      })
    const element = behaviorElement({
      behavior: 'reveal',
      hydrate: 'load',
      props: '{}',
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
    const mount = vi.fn().mockImplementation((context: BehaviorMountContext) => (
      context.signal.addEventListener('abort', teardown, { once: true })
    ))
    const element = behaviorElement({
      behavior: 'reveal',
      hydrate: 'load',
      props: '{}',
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
    const mount = vi.fn().mockImplementation((context: BehaviorMountContext) => (
      context.signal.addEventListener('abort', teardowns[index++]!, { once: true })
    ))
    const root = rootWith([
      behaviorElement({ behavior: 'reveal', hydrate: 'load', props: '{}' }),
      behaviorElement({ behavior: 'reveal', hydrate: 'load', props: '{}' }),
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
