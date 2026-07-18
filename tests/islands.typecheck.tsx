import { defineIsland } from '../src/framework/islands'

defineIsland('valid', (_props: {
  title: string
  count?: number
  options: Array<{ label: string; selected: boolean }>
}) => null)

// @ts-expect-error Functions cannot cross the static HTML serialization boundary.
defineIsland('invalid-function', (_props: { onClick: () => void }) => null)

// @ts-expect-error Class instances cannot cross the static HTML serialization boundary.
defineIsland('invalid-date', (_props: { createdAt: Date }) => null)

// @ts-expect-error hydrate is reserved for the framework hydration strategy.
defineIsland('invalid-reserved-prop', (_props: { hydrate: string }) => null)

// @ts-expect-error Broad object props cannot cross the static HTML serialization boundary.
defineIsland('invalid-object', (_props: { value: object }) => null)

// @ts-expect-error Required undefined cannot cross the static HTML serialization boundary.
defineIsland('invalid-required-undefined', (_props: { value: undefined }) => null)

// @ts-expect-error A union branch cannot hide non-serializable props.
defineIsland('invalid-union', (_props: { value: string } | { onClick: () => void }) => null)
