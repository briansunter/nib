import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  IslandRenderContext,
  composedIslandRenderer,
  island,
  islandDefinitionId,
  isIslandDefinition,
  validateIslandModule,
  validateIslandModules,
  type IslandRenderRequest,
} from '../src/framework/islands'
import { registeredIsland } from './helpers/islands'

describe('React island definitions', () => {
  it('derives an ID from the default-export module path', () => {
    const Counter = island(({ count }: { count: number }) => <button>{count}</button>)

    expect(islandDefinitionId(Counter)).toBe('')
    expect(validateIslandModule('./islands/cart/counter.tsx', { default: Counter }))
      .toBe(Counter)
    expect(islandDefinitionId(Counter)).toBe('cart/counter')
    expect(Counter.when).toBe('load')
    expect(Object.isFrozen(Counter)).toBe(true)
    expect(Reflect.set(Counter, 'when', 'visible')).toBe(false)
  })

  it('fixes hydration policy on the definition and sends it to the renderer', () => {
    const Counter = registeredIsland(
      'counter',
      island(({ count }: { count: number }) => <button>{count}</button>, {
        when: 'visible',
      }),
    )
    let captured: IslandRenderRequest | undefined
    const html = renderToStaticMarkup(
      <IslandRenderContext.Provider value={{
        render(request) {
          captured = request
          return <span>{String(request.props.count)}</span>
        },
      }}>
        <Counter count={2} />
      </IslandRenderContext.Provider>,
    )

    expect(html).toBe('<span>2</span>')
    expect(captured).toMatchObject({
      definition: Counter,
      props: { count: 2 },
      when: 'visible',
    })
  })

  it('validates definitions, strategies, and duplicate paths', () => {
    const Counter = island(() => <button>Count</button>)
    expect(isIslandDefinition(Counter)).toBe(true)
    expect(() => renderToStaticMarkup(<Counter />)).toThrow('default export')
    expect(() => island(() => null, { when: 'idle' as never }))
      .toThrow('Invalid island hydration strategy')
    expect(() => validateIslandModule('./islands/counter.tsx', { default: () => null }))
      .toThrow('default-export island(...)')

    const First = island(() => null)
    const Second = island(() => null)
    expect(() => validateIslandModules({
      './islands/counter.tsx': { default: First },
      '/src/islands/counter.tsx': { default: Second },
    })).toThrow('Duplicate island ID')
  })

  it('composes nested definitions inside one owning React root', () => {
    // Nested definitions are implementation details of the owning island and
    // do not need their own module identity or hydration root.
    const Label = island(({ text }: { text: string }) => <span>{text}</span>)
    const Counter = registeredIsland(
      'counter',
      island(({ count }: { count: number }) => (
        <button><Label text={`Count: ${count}`} /></button>
      )),
    )
    const html = renderToStaticMarkup(createElement(
      IslandRenderContext.Provider,
      { value: composedIslandRenderer() },
      createElement(Counter, { count: 3 }),
    ))

    expect(html).toBe('<button><span>Count: 3</span></button>')
  })
})
