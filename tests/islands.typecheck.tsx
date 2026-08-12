import { island } from '../src/react'

const Counter = island((props: {
  title: string
  count?: number
  options: Array<{ label: string; selected: boolean }>
}) => <button>{props.title}: {props.count ?? 0}</button>, { when: 'visible' })

;<Counter title="Cart" options={[]} />

// @ts-expect-error module identity is framework-private
Counter.islandId

// @ts-expect-error the wrapped component is framework-private
Counter.Component

// @ts-expect-error hydration timing is fixed on the island definition
;<Counter title="Cart" options={[]} when="load" />

// @ts-expect-error idle hydration is intentionally unsupported
island(() => null, { when: 'idle' })

// @ts-expect-error functions cannot cross the static HTML boundary
island((_props: { onClick: () => void }) => null)

// @ts-expect-error class instances cannot cross the static HTML boundary
island((_props: { createdAt: Date }) => null)

// @ts-expect-error broad objects cannot cross the static HTML boundary
island((_props: { value: object }) => null)

// @ts-expect-error async components cannot be statically server-rendered
island(async () => null)
