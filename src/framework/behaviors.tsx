import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from 'react'
import {
  serializeIslandProps,
  type JsonSerializableObject,
} from './island-serialization'
import { validateIslandId } from './island-paths'
import {
  isHydrationStrategy,
  type HydrationStrategy,
} from './hydration'
import {
  ClientOwnershipContext,
  clientOwnershipError,
} from './client-ownership'

/** @internal Collects framework-authored behavior markers during SSR. */
export const BehaviorRenderContext = createContext<Set<string> | null>(null)

export type BehaviorProps<Props extends object = Record<never, never>> = {
  /** Module path below `src/behaviors`, without the `.client.*` suffix. */
  name: string
  /** When to load and mount the matching client module. */
  when?: HydrationStrategy
  children?: ReactNode
  props?: JsonSerializableObject<Props> extends true ? Props : never
}

function renderBehavior(
  behaviorId: string,
  received: {
    children?: ReactNode
    when?: HydrationStrategy
    props?: object
  },
) {
  const owner = useContext(ClientOwnershipContext)
  if (owner !== null) {
    throw clientOwnershipError(
      { kind: 'behavior', name: behaviorId },
      owner,
    )
  }
  useContext(BehaviorRenderContext)?.add(behaviorId)
  const { props = {}, when = 'load', children } = received
  if (!isHydrationStrategy(when)) {
    throw new Error(`Invalid hydration strategy for behavior ${behaviorId}: ${String(when)}`)
  }
  return createElement(
    'nib-behavior',
    {
      'data-behavior': behaviorId,
      'data-hydrate': when,
      'data-props': serializeIslandProps(props),
      style: { display: 'contents' },
    },
    createElement(
      ClientOwnershipContext.Provider,
      { value: { kind: 'behavior', name: behaviorId } },
      children,
    ),
  )
}

/**
 * Adds route-scoped browser behavior to existing static HTML.
 *
 * `name="search"` maps directly to `src/behaviors/search.client.ts`. The
 * matching module is only loaded on pages that render this boundary.
 */
export function Behavior<const Props extends object = Record<never, never>>(
  received: BehaviorProps<Props>,
) {
  const { name, when = 'load', props = {}, children } = received
  return renderBehavior(validateIslandId(name), {
    children,
    when,
    props,
  })
}
