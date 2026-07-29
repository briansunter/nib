import { island } from '../src/framework/islands'

island((_props: {
  title: string
  count?: number
}) => null)

// @ts-expect-error Functions cannot cross the static HTML serialization boundary.
island((_props: { onClick: () => void }) => null)

// @ts-expect-error Nib's static server renderer requires synchronous island components.
island(async () => null)

island((_props: {
  title: string
  count?: number
  options: Array<{ label: string; selected: boolean }>
}) => null)

// @ts-expect-error Nib's static server renderer requires synchronous island components.
island(async () => null)

// @ts-expect-error Functions cannot cross the static HTML serialization boundary.
island((_props: { onClick: () => void }) => null)

// @ts-expect-error Class instances cannot cross the static HTML serialization boundary.
island((_props: { createdAt: Date }) => null)

// @ts-expect-error when is reserved for the framework hydration strategy.
island((_props: { when: string }) => null)

// @ts-expect-error Broad object props cannot cross the static HTML serialization boundary.
island((_props: { value: object }) => null)

// @ts-expect-error Required undefined cannot cross the static HTML serialization boundary.
island((_props: { value: undefined }) => null)

// @ts-expect-error A union branch cannot hide non-serializable props.
island((_props: { value: string } | { onClick: () => void }) => null)
