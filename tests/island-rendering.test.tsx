import { createElement, useId } from 'react'
import { describe, expect, it } from 'vitest'
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
