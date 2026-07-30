import {
  Children,
  cloneElement,
  createContext,
  createElement,
  useContext,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  serializeClientProps,
  type JsonSerializableObject,
} from './island-serialization'
import { validateIslandId } from './island-paths'
import { isClientMountStrategy, type ClientMountStrategy } from './hydration'
import {
  ClientOwnershipContext,
  clientOwnershipError,
} from './client-ownership'

/** @internal Collects framework-authored behavior markers during SSR. */
export const BehaviorRenderContext = createContext<Set<string> | null>(null)

export type BehaviorProps<Props extends object = Record<never, never>> = {
  /** Module path below `src/behaviors`, without the `.client.*` suffix. */
  name: string
  /** When to load and mount the matching client module. Omit for immediate mount. */
  when?: ClientMountStrategy
  children?: ReactNode
  props?: JsonSerializableObject<Props> extends true ? Props : never
}

function renderBehavior(
  behaviorId: string,
  received: {
    children?: ReactNode
    when?: ClientMountStrategy | undefined
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
  const { props = {}, when, children } = received
  if (when !== undefined && !isClientMountStrategy(when)) {
    throw new Error(`Invalid hydration strategy for behavior ${behaviorId}: ${String(when)}`)
  }
  return createElement(
    'nib-behavior',
    {
      'data-behavior': behaviorId,
      ...(when !== undefined ? { 'data-hydrate': when } : {}),
      'data-props': serializeClientProps(props),
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
  const { name, when, props = {}, children } = received
  return renderBehavior(validateIslandId(name), {
    children,
    when,
    props,
  })
}

/**
 * A region behavior that defers mounting until a strategy fires (e.g. `visible`).
 * Use for expensive integrations; `<Behavior>` mounts immediately by default.
 */
export function LazyBehavior<const Props extends object = Record<never, never>>(
  received: BehaviorProps<Props> & { when: ClientMountStrategy },
) {
  const { name, when, props = {}, children } = received
  return renderBehavior(validateIslandId(name), {
    children,
    when,
    props,
  })
}

/** A co-located .client module imported by reference; the build stamps its id. */
export type BehaviorModuleRef = { readonly __nibBehaviorId: string }

export type EnhanceProps<Props extends object = Record<never, never>> = {
  /** Behavior id, or an imported .client module reference (co-located). */
  behavior: string | BehaviorModuleRef
  /** When to load and mount the matching client module. Omit for immediate mount. */
  when?: ClientMountStrategy
  props?: JsonSerializableObject<Props> extends true ? Props : never
  /** Exactly one element; the behavior marker is placed directly on it (no wrapper). */
  children: ReactElement
}

/**
 * Wrapper-free single-element behavior: clones its single child and places the
 * behavior marker directly on that element (no `<nib-behavior>` region). The
 * behavior's `root` is the enhanced element itself, so prefer `root.matches` /
 * direct access over `root.querySelector` for the owned element. Reserve for
 * exactly-one-element enhancement; use `<Behavior>` for multi-element regions.
 */
export function Enhance<const Props extends object = Record<never, never>>(
  received: EnhanceProps<Props>,
) {
  const { behavior, when, props = {}, children } = received
  const behaviorId = typeof behavior === 'string'
    ? validateIslandId(behavior)
    : behavior.__nibBehaviorId
  const owner = useContext(ClientOwnershipContext)
  if (owner !== null) {
    throw clientOwnershipError(
      { kind: 'behavior', name: behaviorId },
      owner,
    )
  }
  if (when !== undefined && !isClientMountStrategy(when)) {
    throw new Error(`Invalid hydration strategy for behavior ${behaviorId}: ${String(when)}`)
  }
  useContext(BehaviorRenderContext)?.add(behaviorId)
  const child = Children.only(children) as ReactElement<Record<string, unknown>>
  return createElement(
    ClientOwnershipContext.Provider,
    { value: { kind: 'behavior', name: behaviorId } },
    cloneElement(child, {
      'data-nib-behavior': behaviorId,
      ...(when !== undefined ? { 'data-hydrate': when } : {}),
      'data-props': serializeClientProps(props),
    }),
  )
}
