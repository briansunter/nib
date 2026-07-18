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
