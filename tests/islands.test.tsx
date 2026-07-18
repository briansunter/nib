import { StrictMode, createElement, useId } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  IslandRenderContext,
  defineIsland,
  isIslandDefinition,
  nestedIslandRenderer,
  validateIslandModule,
  validateIslandModules,
} from '../src/framework/islands'
import { renderReactPage } from '../src/framework/render-page'

describe('React islands', () => {
  it('creates typed island definitions and validates module paths', () => {
    const Counter = defineIsland('counter', ({ count }: { count: number }) => <button>{count}</button>)

    expect(isIslandDefinition(Counter)).toBe(true)
    expect(Counter.islandId).toBe('counter')
    expect(validateIslandModule('./islands/counter.tsx', { default: Counter })).toBe(Counter)
    expect(() => validateIslandModule('./islands/other.tsx', { default: Counter })).toThrow('ID mismatch')
    expect(() => validateIslandModule('./islands/counter.tsx', { default: () => null })).toThrow('defineIsland')
  })

  it('rejects duplicate island definitions', () => {
    const Counter = defineIsland('counter', () => <button>Count</button>)
    expect(() => validateIslandModules({
      './islands/counter.tsx': { default: Counter },
      '/src/islands/counter.tsx': { default: Counter },
    })).toThrow('Duplicate island ID')
  })

  it('renders static pages without island metadata', () => {
    expect(renderReactPage(<main>Static</main>)).toEqual({
      html: '<main>Static</main>',
      islands: [],
    })
  })

  it('renders each island as an independent server root', () => {
    const Field = defineIsland('field', ({ label }: { label: string }) => {
      const id = useId()
      return <label htmlFor={id}>{label}<input id={id} /></label>
    })
    const rendered = renderReactPage(<main><Field label="Name" hydrate="visible" /></main>)
    const expectedIslandHtml = renderToString(
      createElement(
        IslandRenderContext.Provider,
        { value: nestedIslandRenderer('field') },
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
    expect(rendered.html).toContain(expectedIslandHtml)
  })

  it('deduplicates module IDs while preserving independent instances', () => {
    const Counter = defineIsland('counter', ({ count }: { count: number }) => <button>{count}</button>)
    const rendered = renderReactPage(
      <main><Counter count={1} /><Counter count={2} hydrate="idle" /></main>,
    )

    expect(rendered.islands).toEqual(['counter'])
    expect(rendered.html).toContain('data-instance="nib-0"')
    expect(rendered.html).toContain('data-instance="nib-1"')
  })

  it('rejects nested islands and non-deterministic shell renders', () => {
    const Inner = defineIsland('inner', () => <button>Inner</button>)
    const Outer = defineIsland('outer', () => <section><Inner /></section>)
    expect(() => renderReactPage(<Outer />)).toThrow('cannot be nested')

    const First = defineIsland('first', () => <button>First</button>)
    const Second = defineIsland('second', () => <button>Second</button>)
    let pass = 0
    function UnstablePage() {
      pass += 1
      return pass === 1 ? <First /> : <Second />
    }
    expect(() => renderReactPage(<UnstablePage />)).toThrow('changed between render passes')
  })

  it('requires the framework renderer and valid hydration strategies', () => {
    const Counter = defineIsland('counter', () => <button>Count</button>)
    expect(() => renderToString(<Counter />)).toThrow('must be rendered by Nib')
    expect(() => renderReactPage(createElement(Counter, { hydrate: 'later' as 'load' })))
      .toThrow('Invalid hydration strategy')
  })
})
