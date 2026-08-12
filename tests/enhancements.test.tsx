import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { enhancementFileToId } from '../src/framework/enhancement-paths'
import { enhance } from '../src/framework/enhancements'
import { renderReactPage } from '../src/framework/render-page'
import {
  createEnhancementRuntime,
  type ClientEnhancement,
} from '../src/runtime/enhancements'

type TestElement = HTMLElement & {
  nested: Set<HTMLElement>
}

function enhancementElement(
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
      selector === '[data-nib-enhancement]'
        ? elements.filter((element) => element.dataset.nibEnhancement !== undefined)
        : []
    ),
    contains: (element: Node) => elements.includes(element as HTMLElement),
  } as unknown as ParentNode
}

function enhancementModules(
  entries: Record<string, ClientEnhancement>,
): Record<string, () => Promise<{ default: ClientEnhancement }>> {
  return Object.fromEntries(Object.entries(entries).map(([name, enhancement]) => [
    `/src/enhancements/${name}/index.client.ts`,
    async () => ({ default: enhancement }),
  ]))
}

describe('enhancement authoring and runtime', () => {
  it('maps spread attributes directly to a client module', () => {
    const rendered = renderReactPage(
      <button {...enhance('filters/search', { when: 'visible' })}>Filter</button>,
    )

    expect(rendered.enhancements).toEqual([
      { id: 'filters/search', when: 'visible' },
    ])
    expect(rendered.html).toContain('data-nib-enhancement="filters/search"')
    expect(rendered.html).toContain('data-nib-when="visible"')
    expect(rendered.html).not.toContain('data-props')
    expect(rendered.html).toContain('>Filter</button>')
  })

  it('rejects invalid enhancement names and timing', () => {
    expect(() => enhance('Search')).toThrow('Invalid enhancement ID')
    expect(() => enhance('search', { when: 'load' as 'visible' }))
      .toThrow('Invalid enhancement timing')
  })

  it('spreads through ordinary components without adding a wrapper', () => {
    function Feature(props: ReturnType<typeof enhance>) {
      return <button {...props}>Feature</button>
    }

    const rendered = renderReactPage(<Feature {...enhance('feature')} />)
    expect(rendered.html).toBe('<button data-nib-enhancement="feature">Feature</button>')
    expect(rendered.enhancements).toEqual([{ id: 'feature', when: 'load' }])
  })

  it('rejects non-HTML namespace roots', () => {
    expect(() => renderReactPage(
      <svg {...enhance('feature')} />,
    )).toThrow('must be attached to an HTML element')
    expect(() => renderReactPage(
      createElement('math', enhance('feature')),
    )).toThrow('must be attached to an HTML element')
    expect(() => renderReactPage(
      <svg>
        {createElement('circle', enhance('feature'))}
      </svg>,
    )).toThrow('must be attached to an HTML element')
    expect(() => renderReactPage(
      createElement('math', null,
        createElement('mrow', enhance('feature')),
      ),
    )).toThrow('must be attached to an HTML element')

    const foreignObject = renderReactPage(
      <svg>
        <foreignObject>
          <div {...enhance('feature')} />
        </foreignObject>
      </svg>,
    )
    expect(foreignObject.enhancements).toEqual([{ id: 'feature', when: 'load' }])
  })

  it('rejects timing metadata without an enhancement root', () => {
    expect(() => renderReactPage(
      <div data-nib-when="visible" />,
    )).toThrow('data-nib-when requires data-nib-enhancement')
  })

  it('allows nested enhancements on different elements', () => {
    const rendered = renderReactPage(
      <article {...enhance('outer')}>
        <button {...enhance('inner')}>Inner</button>
      </article>,
    )

    expect(rendered.enhancements).toEqual([
      { id: 'outer', when: 'load' },
      { id: 'inner', when: 'load' },
    ])
    expect(rendered.html).toContain('data-nib-enhancement="outer"')
    expect(rendered.html).toContain('data-nib-enhancement="inner"')
  })

  it('mounts immediately by default and emits no scheduling metadata', () => {
    const rendered = renderReactPage(
      <div {...enhance('reveal')}>Details</div>,
    )

    expect(rendered.enhancements).toEqual([{ id: 'reveal', when: 'load' }])
    expect(rendered.html).not.toContain('data-nib-when')
    expect(rendered.html).not.toContain('data-scheduled')
    expect(rendered.html).not.toContain('data-props')
  })

  it('derives ids only from enhancement directory index modules', () => {
    expect(enhancementFileToId('/src/enhancements/search/index.client.ts')).toBe('search')
    expect(enhancementFileToId('/src/enhancements/filters/search/index.client.js'))
      .toBe('filters/search')
    expect(enhancementFileToId(
      'C:\\site\\src\\enhancements\\filter-panel\\index.client.ts?import',
    )).toBe('filter-panel')
    expect(() => enhancementFileToId('/src/enhancements/search.client.ts'))
      .toThrow('must be named src/enhancements/<name>/index.client.ts or .js')
    expect(() => enhancementFileToId('/src/enhancements/search/index.client.tsx'))
      .toThrow('must be named src/enhancements/<name>/index.client.ts or .js')
  })

  it('does not mistake marker text inside a script for an enhancement', () => {
    const rendered = renderReactPage(
      <script dangerouslySetInnerHTML={{
        __html: 'const example = `<div data-nib-enhancement="fake"></div>`',
      }} />,
    )

    expect(rendered.enhancements).toEqual([])
  })

  it('uses final parsed HTML as the enhancement source of truth', () => {
    const rendered = renderReactPage(
      <div dangerouslySetInnerHTML={{
        __html: [
          '<button data-nib-enhancement="reveal">Reveal</button>',
          '<button data-nib-enhancement="reveal" data-nib-when="visible">Later</button>',
        ].join(''),
      }} />,
    )
    expect(rendered.enhancements).toEqual([
      { id: 'reveal', when: 'load' },
      { id: 'reveal', when: 'visible' },
    ])
  })

  it('validates raw enhancement metadata from final parsed HTML', () => {
    expect(() => renderReactPage(
      <div data-nib-enhancement="Search" />,
    )).toThrow('Invalid enhancement ID')
    expect(() => renderReactPage(
      <div data-nib-enhancement="search" data-nib-when="load" />,
    )).toThrow('Invalid enhancement timing')
  })

  it('renders server content without a props payload', () => {
    const html = renderToStaticMarkup(
      <button {...enhance('reveal', { when: 'visible' })}>Details</button>,
    )
    expect(html).toContain('data-nib-enhancement="reveal"')
    expect(html).toContain('data-nib-when="visible"')
    expect(html).not.toContain('data-props')
    expect(html).toContain('>Details</button>')
  })

  it('passes the marked root and signal as positional enhancement arguments', async () => {
    const mount = vi.fn<ClientEnhancement>()
    const element = enhancementElement({ nibEnhancement: 'reveal' })
    const root = rootWith([element])
    const runtime = createEnhancementRuntime(enhancementModules({ reveal: mount }))

    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    expect(mount.mock.calls[0]?.[0]).toBe(element)
    const signal = mount.mock.calls[0]?.[1]
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal?.aborted).toBe(false)
    expect(element.dataset.scheduled).toBeUndefined()

    runtime.destroy()
    expect(signal?.aborted).toBe(true)
  })

  it('loads a module once and cleans each mounted root exactly once', async () => {
    const cleanup = vi.fn()
    const mount = vi.fn<ClientEnhancement>((_root, signal) => {
      signal.addEventListener('abort', cleanup, { once: true })
    })
    const load = vi.fn(async () => ({ default: mount }))
    const first = enhancementElement({ nibEnhancement: 'reveal' })
    const second = enhancementElement({ nibEnhancement: 'reveal' })
    const root = rootWith([first, second])
    const runtime = createEnhancementRuntime({
      '/src/enhancements/reveal/index.client.ts': load,
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))
    expect(load).toHaveBeenCalledOnce()
    runtime.destroy()
    runtime.destroy()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('observes only the enhancement root for visible timing', async () => {
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
    const child = enhancementElement({})
    const element = enhancementElement({
      nibEnhancement: 'reveal',
      nibWhen: 'visible',
    }, [child])
    const mount = vi.fn<ClientEnhancement>()
    const runtime = createEnhancementRuntime(enhancementModules({ reveal: mount }), {
      environment: {
        IntersectionObserver,
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

  it('loads visible enhancements immediately when observation is unavailable', async () => {
    const mount = vi.fn<ClientEnhancement>()
    const element = enhancementElement({
      nibEnhancement: 'reveal',
      nibWhen: 'visible',
    })
    const runtime = createEnhancementRuntime(enhancementModules({ reveal: mount }), {
      environment: {},
    })

    runtime.mount(rootWith([element]))
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
  })

  it('cancels pending visible work when the runtime is destroyed', () => {
    let intersectionCallback: IntersectionObserverCallback | undefined
    const disconnect = vi.fn()
    class TestIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback
      }

      observe = vi.fn()
      disconnect = disconnect
    }
    const IntersectionObserver = TestIntersectionObserver as unknown as typeof window.IntersectionObserver
    const mount = vi.fn<ClientEnhancement>()
    const element = enhancementElement({
      nibEnhancement: 'reveal',
      nibWhen: 'visible',
    })
    const root = rootWith([element])
    const runtime = createEnhancementRuntime(enhancementModules({ reveal: mount }), {
      environment: { IntersectionObserver },
    })

    runtime.mount(root)
    expect(element.dataset.scheduled).toBeUndefined()
    runtime.destroy()
    intersectionCallback?.([
      { isIntersecting: true } as IntersectionObserverEntry,
    ], {} as IntersectionObserver)
    expect(disconnect).toHaveBeenCalledOnce()
    expect(mount).not.toHaveBeenCalled()
  })

  it('cleans nested enhancement signals deepest first on destroy', async () => {
    const cleanupOrder: string[] = []
    const outerMount = vi.fn<ClientEnhancement>((_root, signal) => {
      signal.addEventListener('abort', () => cleanupOrder.push('outer'), { once: true })
    })
    const innerMount = vi.fn<ClientEnhancement>((_root, signal) => {
      signal.addEventListener('abort', () => cleanupOrder.push('inner'), { once: true })
    })
    const inner = enhancementElement({ nibEnhancement: 'inner' })
    const outer = enhancementElement({ nibEnhancement: 'outer' }, [inner])
    const unrelated = enhancementElement({ nibEnhancement: 'unrelated' })
    const elements = [outer, inner, unrelated]
    const root = rootWith(elements)
    const runtime = createEnhancementRuntime(enhancementModules({
      outer: outerMount,
      inner: innerMount,
      unrelated: () => {},
    }))

    runtime.mount(root)
    await vi.waitFor(() => expect(innerMount).toHaveBeenCalledOnce())
    expect(outerMount.mock.calls[0]?.[1]).not.toBe(innerMount.mock.calls[0]?.[1])

    runtime.destroy()
    runtime.destroy()
    expect(cleanupOrder).toEqual(['inner', 'outer'])
  })

  it('accepts plain JavaScript and typed TypeScript default exports', async () => {
    const plainMount = vi.fn<ClientEnhancement>()
    const typedMount = vi.fn<ClientEnhancement>()
    const root = rootWith([
      enhancementElement({ nibEnhancement: 'plain' }),
      enhancementElement({ nibEnhancement: 'typed' }),
    ])
    const runtime = createEnhancementRuntime({
      '/src/enhancements/plain/index.client.js': async () => ({ default: plainMount }),
      '/src/enhancements/typed/index.client.ts': async () => ({ default: typedMount }),
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(plainMount).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(typedMount).toHaveBeenCalledOnce())
  })

  it('cleans a marker detached during module loading', async () => {
    let resolveModule!: (module: { default: ClientEnhancement }) => void
    const mount = vi.fn<ClientEnhancement>()
    const load = vi.fn(() => new Promise<{ default: ClientEnhancement }>((resolve) => {
      resolveModule = resolve
    }))
    const element = enhancementElement({ nibEnhancement: 'reveal' })
    const elements = [element]
    const root = rootWith(elements)
    const runtime = createEnhancementRuntime({
      '/src/enhancements/reveal/index.client.ts': load,
    })

    runtime.mount(root)
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    elements.pop()
    resolveModule({ default: mount })
    expect(mount).not.toHaveBeenCalled()
    expect(load).toHaveBeenCalledOnce()
  })

  it('cleans a marker detached during async mount', async () => {
    let resolveMount!: () => void
    const firstCleanup = vi.fn()
    const mount = vi.fn<ClientEnhancement>((_root, signal) => {
      signal.addEventListener('abort', firstCleanup, { once: true })
      return new Promise<void>((resolve) => {
        resolveMount = resolve
      })
    })
    const element = enhancementElement({ nibEnhancement: 'reveal' })
    const elements = [element]
    const root = rootWith(elements)
    const runtime = createEnhancementRuntime(enhancementModules({ reveal: mount }))

    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce())
    elements.pop()
    resolveMount()
    await vi.waitFor(() => expect(firstCleanup).toHaveBeenCalledOnce())
    expect(mount.mock.calls[0]?.[1].aborted).toBe(true)
  })

  it('aborts every enhancement signal on destroy', async () => {
    const cleanup = vi.fn()
    const mount = vi.fn<ClientEnhancement>((_root, signal) => {
      signal.addEventListener('abort', cleanup, { once: true })
    })
    const root = rootWith([
      enhancementElement({ nibEnhancement: 'reveal' }),
      enhancementElement({ nibEnhancement: 'reveal' }),
    ])
    const runtime = createEnhancementRuntime(enhancementModules({ reveal: mount }))
    runtime.mount(root)
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(2))

    runtime.destroy()
    expect(cleanup).toHaveBeenCalledTimes(2)
    expect(() => runtime.destroy()).not.toThrow()
    expect(() => runtime.mount(root)).toThrow('destroyed Nib enhancement runtime')
  })

  it('reports invalid metadata, missing modules, and invalid exports', async () => {
    const reportError = vi.fn()
    const invalidWhen = enhancementElement({
      nibEnhancement: 'reveal',
      nibWhen: 'later',
    })
    const missing = enhancementElement({ nibEnhancement: 'missing' })
    const invalidExport = enhancementElement({ nibEnhancement: 'invalid-export' })
    const root = rootWith([invalidWhen, missing, invalidExport])
    const runtime = createEnhancementRuntime({
      '/src/enhancements/reveal/index.client.ts': async () => ({ default: vi.fn() }),
      '/src/enhancements/invalid-export/index.client.ts': async () => ({ default: null }),
    }, { reportError })

    runtime.mount(root)
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(3))
    expect(reportError.mock.calls.map(([id]) => id)).toEqual([
      'reveal',
      'missing',
      'invalid-export',
    ])
  })

  it('rejects duplicate filename-derived IDs', () => {
    expect(() => createEnhancementRuntime({
      '/src/enhancements/reveal/index.client.ts': async () => ({ default: null }),
      './src/enhancements/reveal/index.client.ts': async () => ({ default: null }),
    })).toThrow('Duplicate enhancement ID')
  })
})
