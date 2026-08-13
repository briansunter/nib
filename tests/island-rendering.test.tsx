import { createElement, useId } from 'react'
import { describe, expect, it } from 'vitest'
import { enhance } from '../src/framework/enhancements'
import { island } from '../src/framework/islands'
import { renderReactPage } from '../src/framework/render-page'
import { registeredIsland } from './helpers/islands'

describe('React island SSR', () => {
  it('renders instances as independent roots with stable useId prefixes', () => {
    const Field = registeredIsland(
      'field',
      island(({ label }: { label: string }) => {
        const id = useId()
        return <label htmlFor={id}>{label}<input id={id} /></label>
      }),
    )

    const rendered = renderReactPage(
      <main><Field label="First" /><Field label="Second" /></main>,
    )

    expect(rendered.islands).toEqual([{ id: 'field', when: 'load' }])
    expect(rendered.html).toContain('data-nib-prefix="nib-0-"')
    expect(rendered.html).toContain('data-nib-prefix="nib-1-"')
    expect(rendered.html).toContain(
      'data-nib-props="{&quot;label&quot;:&quot;First&quot;}"',
    )
    expect(rendered.html).toContain(
      'data-nib-props="{&quot;label&quot;:&quot;Second&quot;}"',
    )
    const ids = [...rendered.html.matchAll(/<input id="([^"]+)"/g)]
      .map((match) => match[1])
    expect(ids).toHaveLength(2)
    expect(ids[0]).toContain('nib-0-')
    expect(ids[1]).toContain('nib-1-')
    expect(ids[0]).not.toBe(ids[1])
  })

  it('keeps island-free output free of island metadata', () => {
    expect(renderReactPage(<main>Static</main>)).toEqual({
      html: '<main>Static</main>',
      enhancements: [],
      islands: [],
    })
  })

  it('rejects nondeterministic island requests across render passes', () => {
    const First = registeredIsland('first', island(() => <p>First</p>))
    const Second = registeredIsland('second', island(() => <p>Second</p>))
    let pass = 0
    function UnstablePage() {
      pass += 1
      return pass === 1 ? <First /> : <Second />
    }

    expect(() => renderReactPage(<UnstablePage />))
      .toThrow('changed between render passes')
  })

  it('rejects island boundaries that the HTML parser restructures', () => {
    const Row = registeredIsland(
      'row',
      island(() => <tr><td>Interactive row</td></tr>),
    )

    expect(() => renderReactPage(
      <table><tbody><Row /></tbody></table>,
    )).toThrow(
      'Place the island in normal flow content, or make the containing table',
    )
  })

  it('rejects manually-authored island boundaries', () => {
    expect(() => renderReactPage(
      <main>{createElement('nib-island', {
        'data-nib-island': 'manual',
      })}</main>,
    )).toThrow('must be authored with island() and rendered by Nib')
  })

  it('rejects enhancement and island roots that contain one another', () => {
    const StaticCounter = registeredIsland(
      'static-counter',
      island(() => <button>Count</button>),
    )
    const EnhancedCounter = registeredIsland(
      'enhanced-counter',
      island(() => <button {...enhance('counter')}>Count</button>),
    )

    expect(() => renderReactPage(
      <section {...enhance('counter')}><StaticCounter /></section>,
    )).toThrow('Enhancement and island roots cannot contain one another')
    expect(() => renderReactPage(<EnhancedCounter />))
      .toThrow('Enhancement and island roots cannot contain one another')
  })

  it('keeps sibling enhancement and island roots independent', () => {
    const Counter = registeredIsland(
      'sibling-counter',
      island(() => <button>Count</button>),
    )

    const rendered = renderReactPage(
      <main>
        <section {...enhance('details')}>Details</section>
        <Counter />
      </main>,
    )

    expect(rendered.enhancements).toEqual([{ id: 'details', when: 'load' }])
    expect(rendered.islands).toEqual([{ id: 'sibling-counter', when: 'load' }])
  })

  it.each([
    '<button data-nib-enhancement="details">Details</button>',
    '<nib-island data-nib-island="counter"></nib-island>',
  ])('rejects client markers in inert template content', (content) => {
    expect(() => renderReactPage(
      <template dangerouslySetInnerHTML={{ __html: content }} />,
    )).toThrow('Nib client markers cannot be placed inside inert <template> content')
  })

  it('renders with the same JSON identity semantics used during hydration', () => {
    const Identity = registeredIsland(
      'identity',
      island(({ first, second }: {
        first: { value: number }
        second: { value: number }
      }) => <p>{first === second ? 'same' : 'different'}</p>),
    )
    const shared = { value: 1 }

    const rendered = renderReactPage(
      <Identity first={shared} second={shared} />,
    )

    expect(rendered.html).toContain('<p>different</p>')
  })
})
