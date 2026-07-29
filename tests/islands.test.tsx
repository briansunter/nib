import { StrictMode, createElement, useId } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  IslandRenderContext,
  composedIslandRenderer,
  island,
  isIslandDefinition,
  validateIslandModule,
  validateIslandModules,
} from '../src/framework/islands'
import { renderReactPage } from '../src/framework/render-page'
import { registeredIsland } from './helpers/islands'

describe('React islands', () => {
  it('derives an island ID from its default-export module path', () => {
    const Counter = island(({ count }: { count: number }) => <button>{count}</button>)

    expect(Counter.islandId).toBe('')
    expect(validateIslandModule('./islands/cart/counter.tsx', {
      default: Counter,
    })).toBe(Counter)
    expect(Counter.islandId).toBe('cart/counter')
    expect(renderReactPage(<Counter count={2} />).islands).toEqual(['cart/counter'])
  })

  it('requires file validation before rendering an inferred island directly', () => {
    const Counter = island(() => <button>Count</button>)
    expect(() => renderReactPage(<Counter />)).toThrow(
      'must be the default export of a module under src/islands',
    )
  })

  it('creates typed island definitions and validates module paths', () => {
    const Counter = island(({ count }: { count: number }) => <button>{count}</button>)

    expect(isIslandDefinition(Counter)).toBe(true)
    expect(Counter.islandId).toBe('')
    expect(validateIslandModule('./islands/counter.tsx', { default: Counter })).toBe(Counter)
    expect(Counter.islandId).toBe('counter')
    expect(() => validateIslandModule('./islands/other.tsx', { default: Counter })).toThrow('ID mismatch')
    expect(() => validateIslandModule('./islands/counter.tsx', { default: () => null }))
      .toThrow('default-export island(...)')
  })

  it('rejects duplicate island definitions', () => {
    const Counter = island(() => <button>Count</button>)
    const Duplicate = island(() => <button>Duplicate</button>)
    expect(() => validateIslandModules({
      './islands/counter.tsx': { default: Counter },
      '/src/islands/counter.tsx': { default: Duplicate },
    })).toThrow('Duplicate island ID')
  })

  it('renders static pages without island metadata', () => {
    expect(renderReactPage(<main>Static</main>)).toEqual({
      html: '<main>Static</main>',
      islands: [],
      behaviors: [],
    })
  })

  it('renders each island as an independent server root', () => {
    const Field = registeredIsland(
      'field',
      island(({ label }: { label: string }) => {
        const id = useId()
        return <label htmlFor={id}>{label}<input id={id} /></label>
      }),
    )
    const rendered = renderReactPage(<main><Field label="Name" when="visible" /></main>)
    const expectedIslandHtml = renderToString(
      createElement(
        IslandRenderContext.Provider,
        { value: composedIslandRenderer() },
        createElement(StrictMode, null, createElement(Field.Component, { label: 'Name' })),
      ),
      { identifierPrefix: 'nib-0-' },
    )

    expect(rendered.islands).toEqual(['field'])
    expect(rendered.html).toContain('data-island="field"')
    expect(rendered.html).toContain('data-instance="nib-0"')
    expect(rendered.html).toContain('data-prefix="nib-0-"')
    expect(rendered.html).toContain('data-hydrate="visible"')
    expect(rendered.html).toContain('data-props="{&quot;label&quot;:&quot;Name&quot;}"')
    expect(rendered.html).toContain('style="display:contents"')
    expect(rendered.html).toContain(expectedIslandHtml)
  })

  it('deduplicates module IDs while preserving independent instances', () => {
    const Counter = registeredIsland(
      'counter',
      island(({ count }: { count: number }) => <button>{count}</button>),
    )
    const rendered = renderReactPage(
      <main><Counter count={1} /><Counter count={2} when="idle" /></main>,
    )

    expect(rendered.islands).toEqual(['counter'])
    expect(rendered.html).toContain('data-instance="nib-0"')
    expect(rendered.html).toContain('data-instance="nib-1"')
  })

  it('composes child islands into the parent root and rejects non-deterministic shell renders', () => {
    const Inner = registeredIsland(
      'inner',
      island(({ label }: { label: string }) => <button>{label}</button>),
    )
    const Outer = registeredIsland(
      'outer',
      island(() => (
        <section><Inner label="Inner" when="visible" /></section>
      )),
    )
    const nested = renderReactPage(<Outer when="idle" />)

    expect(nested.islands).toEqual(['outer'])
    expect(nested.html).toContain('data-island="outer"')
    expect(nested.html).not.toContain('data-island="inner"')
    expect(nested.html).toContain('<section><button>Inner</button></section>')

    const First = registeredIsland('first', island(() => <button>First</button>))
    const Second = registeredIsland('second', island(() => <button>Second</button>))
    let pass = 0
    function UnstablePage() {
      pass += 1
      return pass === 1 ? <First /> : <Second />
    }
    expect(() => renderReactPage(<UnstablePage />)).toThrow('changed between render passes')
  })

  it('requires the framework renderer and valid hydration strategies', () => {
    const Counter = registeredIsland('counter', island(() => <button>Count</button>))
    expect(() => renderToString(<Counter />)).toThrow('must be rendered by Nib')
    expect(() => renderReactPage(createElement(Counter, { when: 'later' as 'load' })))
      .toThrow('Invalid hydration strategy')
  })
})
