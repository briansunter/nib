import {
  Children,
  cloneElement,
  createContext,
  createElement,
  useContext,
  type ReactElement,
} from 'react'
import { validateBehaviorId } from './behavior-paths'
import {
  ClientOwnershipContext,
  clientOwnershipError,
} from './client-ownership'
import { isIslandDefinition } from './islands'

/** @internal Collects framework-authored behavior markers during SSR. */
export const BehaviorRenderContext = createContext<Set<string> | null>(null)

export type BehaviorDeferStrategy = 'idle' | 'visible'

export type BehaviorProps = {
  /** Module path below `src/behaviors`, without the `.client.*` suffix. */
  name: string
  /** Defer loading and mounting until the matching strategy fires. */
  defer?: BehaviorDeferStrategy
  /** Exactly one existing element receives the behavior marker. */
  children: ReactElement
}

function resolveDefer(
  behaviorId: string,
  defer: BehaviorDeferStrategy | undefined,
): BehaviorDeferStrategy | undefined {
  if (defer !== undefined && defer !== 'idle' && defer !== 'visible') {
    throw new Error(`Invalid defer strategy for behavior ${behaviorId}: ${String(defer)}`)
  }
  return defer
}

function renderBehaviorElement(
  behaviorId: string,
  received: {
    children: ReactElement
    defer?: BehaviorDeferStrategy | undefined
  },
) {
  const owner = useContext(ClientOwnershipContext)
  if (owner?.kind === 'island') {
    throw clientOwnershipError(
      { kind: 'behavior', name: behaviorId },
      owner,
    )
  }
  useContext(BehaviorRenderContext)?.add(behaviorId)
  const { defer, children } = received
  const strategy = resolveDefer(behaviorId, defer)
  const child = Children.only(children) as ReactElement<Record<string, unknown>>
  if (isIslandDefinition(child.type)) {
    throw clientOwnershipError(
      { kind: 'island', name: child.type.islandId },
      { kind: 'behavior', name: behaviorId },
    )
  }
  if (typeof child.type !== 'string') {
    throw new Error(
      `Behavior ${JSON.stringify(behaviorId)} requires one existing DOM element child`,
    )
  }
  const childProps = child.props as Record<string, unknown>
  if (childProps['data-nib-behavior'] !== undefined) {
    throw new Error(
      `Behavior ${JSON.stringify(behaviorId)} cannot share an element with another behavior`,
    )
  }
  return createElement(
    ClientOwnershipContext.Provider,
    { value: { kind: 'behavior', name: behaviorId } },
    cloneElement(child, {
      'data-nib-behavior': behaviorId,
      ...(strategy !== undefined ? { 'data-nib-defer': strategy } : {}),
    }),
  )
}

/**
 * Adds route-scoped browser behavior to one existing static element.
 *
 * `name="search"` maps directly to `src/behaviors/search.client.ts`. The
 * matching module is only loaded on pages that render this boundary.
 */
export function Behavior(
  received: BehaviorProps,
) {
  const { name, defer, children } = received
  return renderBehaviorElement(validateBehaviorId(name), {
    children,
    defer,
  })
}
