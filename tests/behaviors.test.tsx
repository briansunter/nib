import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { behaviorFileToId } from '../src/framework/behavior-paths'
import { Behavior } from '../src/framework/behaviors'
import { renderReactPage } from '../src/framework/render-page'
import {
  createBehaviorRuntime,
  type ClientBehavior,
} from '../src/runtime/behaviors'

type TestElement = HTMLElement & {
  nested: Set<HTMLElement>
}

function behaviorElement(
  dataset: Record<string, string>,
  nested: readonly HTMLElement[] = [],
): TestElement {
  const contained = new Set(nested)
  return {
    dataset,
    nested: contained,
    contains(node: Node) {
      return contained.has(node as HTMLElement)
    },
  } as unknown as TestElement
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

function behaviorModules(
  entries: Record<string, ClientBehavior>,
): Record<string, () => Promise<{ default: ClientBehavior }>> {
  return Object.fromEntries(Object.entries(entries).map(([name, behavior]) => [
    `/src/behaviors/${name}/index.client.ts`,
    async () => ({ default: behavior }),
  ]))
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

  it('requires exactly one existing DOM element as its root', () => {
    function Feature() {
      return <button>Feature</button>
    }
    expect(() => renderReactPage(
      <Behavior name="feature"><Feature /></Behavior>,
    )).toThrow('requires one existing HTML element child')
    expect(() => renderReactPage(
      <Behavior name="feature" children={null as never} />,
    )).toThrow()
    expect(() => renderReactPage(
      <Behavior
        name="feature"
        children={[<div key="one" />, <div key="two" />] as never}
      />,
    )).toThrow()
  })

  it('rejects non-HTML namespace roots', () => {
    expect(() => renderReactPage(
      <Behavior name="feature"><svg /></Behavior>,
    )).toThrow('requires one existing HTML element child')
    expect(() => renderReactPage(
      <Behavior name="feature">{createElement('math')}</Behavior>,
    )).toThrow('requires one existing HTML element child')
    expect(() => renderReactPage(
      <svg>
        <Behavior name="feature">{createElement('circle')}</Behavior>
      </svg>,
    )).toThrow('Behavior roots must be HTML elements')
    expect(() => renderReactPage(
      createElement('math', null,
        <Behavior name="feature">{createElement('mrow')}</Behavior>,
      ),
    )).toThrow('Behavior roots must be HTML elements')

    const foreignObject = renderReactPage(
      <svg>
        <foreignObject>
          <Behavior name="feature"><div /></Behavior>
        </foreignObject>
      </svg>,
    )
    expect(foreignObject.behaviors).toEqual(['feature'])
  })

  it('rejects framework-owned attributes on a behavior root', () => {
    expect(() => renderReactPage(
      <Behavior name="feature"><div data-nib-behavior="existing" /></Behavior>,
    )).toThrow('owns data-nib-behavior and data-nib-defer on its root')
    expect(() => renderReactPage(
      <Behavior name="feature"><div data-nib-defer="idle" /></Behavior>,
    )).toThrow('owns data-nib-behavior and data-nib-defer on its root')
  })

  it('allows nested behaviors on different elements', () => {
    const rendered = renderReactPage(
      <Behavior name="outer">
        <article>
          <Behavior name="inner"><button>Inner</button></Behavior>
        </article>
      </Behavior>,
    )

    expect(rendered.behaviors).toEqual(['outer', 'inner'])
    expect(rendered.html).toContain('data-nib-behavior="outer"')
    expect(rendered.html).toContain('data-nib-behavior="inner"')
  })

  it('mounts immediately by default and emits no scheduling metadata', () => {
    const rendered = renderReactPage(
      <Behavior name="reveal"><div>Details</div></Behavior>,
    )

    expect(rendered.behaviors).toEqual(['reveal'])
    expect(rendered.html).not.toContain('data-nib-defer')
    expect(rendered.html).not.toContain('data-scheduled')
    expect(rendered.html).not.toContain('data-props')
  })

  it('derives ids only from behavior directory index modules', () => {
    expect(behaviorFileToId('/src/behaviors/search/index.client.ts')).toBe('search')
    expect(behaviorFileToId('/src/behaviors/filters/search/index.client.js'))
      .toBe('filters/search')
    expect(behaviorFileToId(
      'C:\\site\\src\\behaviors\\filter-panel\\index.client.ts?import',
    )).toBe('filter-panel')
    expect(() => behaviorFileToId('/src/behaviors/search.client.ts'))
      .toThrow('must be named src/behaviors/<name>/index.client.ts or .js')
    expect(() => behaviorFileToId('/src/behaviors/search/index.client.tsx'))
      .toThrow('must be named src/behaviors/<name>/index.client.ts or .js')
  })

  it('does not mistake marker text inside a script for a behavior', () => {
    const rendered = renderReactPage(
      <script dangerouslySetInnerHTML={{
        __html: 'const example = `<div data-nib-behavior="fake"></div>`',
      }} />,
    )

    expect(rendered.behaviors).toEqual([])
  })

  it('rejects manually authored framework markers anywhere in rendered HTML', () => {
    expect(() => renderReactPage(<div data-nib-behavior="reveal" />))
      .toThrow('declare client enhancements with <Behavior>')
    expect(() => renderReactPage(<div data-nib-defer="idle" />))
      .toThrow('declare client enhancements with <Behavior>')
    expect(() => renderReactPage(
      <>
        <Behavior name="reveal"><div /></Behavior>
        <div data-nib-behavior="reveal" />
      </>,
    )).toThrow('declare client enhancements with <Behavior>')
    expect(() => renderReactPage(
      <div dangerouslySetInnerHTML={{
        __html: '<button data-nib-behavior="reveal">Reveal</button>',
      }} />,
    )).toThrow('declare client enhancements with <Behavior>')
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

  it('passes the marked root and signal as positional behavior arguments', async () => {
    const mount = vi.fn<ClientBehavior>()
    const element = behaviorElement({ nibBehavior: 'reveal' })
    const root = rootWith([element])
    const runtime = createBehaviorRuntime(behaviorModules({ reveal: mount }))

    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    expect(mount.mock.calls[0]?.[0]).toBe(element)
    const signal = mount.mock.calls[0]?.[1]
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal?.aborted).toBe(false)
    expect(element.dataset.scheduled).toBeUndefined()

    runtime.unmount(root)
    expect(signal?.aborted).toBe(true)
  })

  it('loads a module once and cleans each mounted root exactly once', async () => {
    const cleanup = vi.fn()
    const mount = vi.fn<ClientBehavior>((_root, signal) => {
      signal.addEventListener('abort', cleanup, { once: true })
    })
    const load = vi.fn(async () => ({ default: mount }))
    const first = behaviorElement({ nibBehavior: 'reveal' })
    const second = behaviorElement({ nibBehavior: 'reveal' })
    const root = rootWith([first, second])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal/index.client.ts': load,
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))
    expect(load).toHaveBeenCalledOnce()
    runtime.unmount(root)
    runtime.unmount(root)
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('observes only the behavior root for visible deferral', async () => {
    let intersectionCallback: IntersectionObserverCallback | undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    const observer = { observe, disconnect }
    class TestIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback
      }

      observe = observe
      disconnect = disconnect
    }
    const IntersectionObserver = TestIntersectionObserver as unknown as typeof window.IntersectionObserver
    const child = behaviorElement({})
    const element = behaviorElement({
      nibBehavior: 'reveal',
      nibDefer: 'visible',
    }, [child])
    const mount = vi.fn<ClientBehavior>()
    const runtime = createBehaviorRuntime(behaviorModules({ reveal: mount }), {
      environment: {
        IntersectionObserver,
        setTimeout: vi.fn(() => 1),
      },
    })

    runtime.mount(rootWith([element]))
    expect(observe).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledWith(element)
    expect(observe).not.toHaveBeenCalledWith(child)
    expect(mount).not.toHaveBeenCalled()

    intersectionCallback?.([
      { isIntersecting: true } as IntersectionObserverEntry,
    ], observer as unknown as IntersectionObserver)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    expect(mount.mock.calls[0]?.[0]).toBe(element)
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('cancels pending idle work before a root is detached', () => {
    let idle: (() => void) | undefined
    const cancelIdleCallback = vi.fn()
    const mount = vi.fn<ClientBehavior>()
    const element = behaviorElement({
      nibBehavior: 'reveal',
      nibDefer: 'idle',
    })
    const root = rootWith([element])
    const runtime = createBehaviorRuntime(behaviorModules({ reveal: mount }), {
      environment: {
        requestIdleCallback(callback) {
          idle = callback
          return 7
        },
        cancelIdleCallback,
        setTimeout: vi.fn(() => 1),
      },
    })

    runtime.mount(root)
    expect(element.dataset.scheduled).toBeUndefined()
    runtime.unmount(root)
    idle?.()
    expect(cancelIdleCallback).toHaveBeenCalledWith(7)
    expect(mount).not.toHaveBeenCalled()
  })

  it('cleans nested behavior signals deepest first even across separate mounts', async () => {
    const cleanupOrder: string[] = []
    const outerMount = vi.fn<ClientBehavior>((_root, signal) => {
      signal.addEventListener('abort', () => cleanupOrder.push('outer'), { once: true })
    })
    const innerMount = vi.fn<ClientBehavior>((_root, signal) => {
      signal.addEventListener('abort', () => cleanupOrder.push('inner'), { once: true })
    })
    const inner = behaviorElement({ nibBehavior: 'inner' })
    const outer = behaviorElement({ nibBehavior: 'outer' }, [inner])
    const unrelated = behaviorElement({ nibBehavior: 'unrelated' })
    const elements = [outer, unrelated]
    const root = rootWith(elements)
    const runtime = createBehaviorRuntime(behaviorModules({
      outer: outerMount,
      inner: innerMount,
      unrelated: () => {},
    }))

    runtime.mount(root)
    elements.push(inner)
    runtime.mount(root)
    await vi.waitFor(() => expect(innerMount).toHaveBeenCalledOnce())
    expect(outerMount.mock.calls[0]?.[1]).not.toBe(innerMount.mock.calls[0]?.[1])

    runtime.unmount(root)
    runtime.unmount(root)
    expect(cleanupOrder).toEqual(['inner', 'outer'])
  })

  it('accepts plain JavaScript and typed TypeScript default exports', async () => {
    const plainMount = vi.fn<ClientBehavior>()
    const typedMount = vi.fn<ClientBehavior>()
    const root = rootWith([
      behaviorElement({ nibBehavior: 'plain' }),
      behaviorElement({ nibBehavior: 'typed' }),
    ])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/plain/index.client.js': async () => ({ default: plainMount }),
      '/src/behaviors/typed/index.client.ts': async () => ({ default: typedMount }),
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(plainMount).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(typedMount).toHaveBeenCalledOnce())
  })

  it('cleans a marker detached during module loading and permits remount', async () => {
    let resolveModule!: (module: { default: ClientBehavior }) => void
    const mount = vi.fn<ClientBehavior>()
    const load = vi.fn(() => new Promise<{ default: ClientBehavior }>((resolve) => {
      resolveModule = resolve
    }))
    const element = behaviorElement({ nibBehavior: 'reveal' })
    const elements = [element]
    const root = rootWith(elements)
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal/index.client.ts': load,
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    elements.pop()
    resolveModule({ default: mount })
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
    const mount = vi.fn<ClientBehavior>()
      .mockImplementationOnce((_root, signal) => {
        signal.addEventListener('abort', firstCleanup, { once: true })
        return new Promise<void>((resolve) => {
          resolveMount = resolve
        })
      })
      .mockImplementationOnce((_root, signal) => {
        signal.addEventListener('abort', secondCleanup, { once: true })
      })
    const element = behaviorElement({ nibBehavior: 'reveal' })
    const elements = [element]
    const root = rootWith(elements)
    const runtime = createBehaviorRuntime(behaviorModules({ reveal: mount }))

    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    elements.pop()
    resolveMount()
    await vi.waitFor(() => expect(firstCleanup).toHaveBeenCalledOnce())
    expect(mount.mock.calls[0]?.[1].aborted).toBe(true)

    elements.push(element)
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))
    runtime.unmount(root)
    expect(secondCleanup).toHaveBeenCalledOnce()
  })

  it('aborts every behavior signal on destroy', async () => {
    const cleanup = vi.fn()
    const mount = vi.fn<ClientBehavior>((_root, signal) => {
      signal.addEventListener('abort', cleanup, { once: true })
    })
    const root = rootWith([
      behaviorElement({ nibBehavior: 'reveal' }),
      behaviorElement({ nibBehavior: 'reveal' }),
    ])
    const runtime = createBehaviorRuntime(behaviorModules({ reveal: mount }))
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))

    runtime.destroy()
    expect(cleanup).toHaveBeenCalledTimes(2)
    expect(() => runtime.destroy()).not.toThrow()
    expect(() => runtime.mount(root)).toThrow('destroyed Nib behavior runtime')
  })

  it('reports invalid metadata, missing modules, and invalid exports', async () => {
    const reportError = vi.fn()
    const invalidDefer = behaviorElement({
      nibBehavior: 'reveal',
      nibDefer: 'later',
    })
    const missing = behaviorElement({ nibBehavior: 'missing' })
    const invalidExport = behaviorElement({ nibBehavior: 'invalid-export' })
    const root = rootWith([invalidDefer, missing, invalidExport])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal/index.client.ts': async () => ({ default: vi.fn() }),
      '/src/behaviors/invalid-export/index.client.ts': async () => ({ default: null }),
    }, { reportError })

    runtime.mount(root)
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(3))
    expect(reportError.mock.calls.map(([id]) => id)).toEqual([
      'reveal',
      'missing',
      'invalid-export',
    ])
  })

  it('clears failed loads so a later mount can retry', async () => {
    const mount = vi.fn<ClientBehavior>()
    const reportError = vi.fn()
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('temporary chunk failure'))
      .mockResolvedValue({ default: mount })
    const element = behaviorElement({ nibBehavior: 'reveal' })
    const root = rootWith([element])
    const runtime = createBehaviorRuntime({
      '/src/behaviors/reveal/index.client.ts': load,
    }, { reportError })

    runtime.mount(root)
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('rejects duplicate filename-derived IDs', () => {
    expect(() => createBehaviorRuntime({
      '/src/behaviors/reveal/index.client.ts': async () => ({ default: null }),
      './src/behaviors/reveal/index.client.ts': async () => ({ default: null }),
    })).toThrow('Duplicate behavior ID')
  })
})
