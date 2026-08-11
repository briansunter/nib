import {
  Children,
  cloneElement,
  createContext,
  useContext,
  type ReactElement,
} from 'react'
import { validateBehaviorId } from './behavior-paths'

/** @internal Collects framework-authored behavior markers during SSR. */
export const BehaviorRenderContext = createContext<Map<string, number> | null>(null)

type BehaviorDeferStrategy = 'idle' | 'visible'

type BehaviorProps = {
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
  const rendered = useContext(BehaviorRenderContext)
  rendered?.set(behaviorId, (rendered.get(behaviorId) ?? 0) + 1)
  const { defer, children } = received
  const strategy = resolveDefer(behaviorId, defer)
  const child = Children.only(children) as ReactElement<Record<string, unknown>>
  if (
    typeof child.type !== 'string'
    || child.type === 'svg'
    || child.type === 'math'
  ) {
    throw new Error(
      `Behavior ${JSON.stringify(behaviorId)} requires one existing HTML element child`,
    )
  }
  const childProps = child.props as Record<string, unknown>
  if (
    childProps['data-nib-behavior'] !== undefined
    || childProps['data-nib-defer'] !== undefined
  ) {
    throw new Error(
      `Behavior ${JSON.stringify(behaviorId)} owns data-nib-behavior and data-nib-defer on its root`,
    )
  }
  return cloneElement(child, {
    'data-nib-behavior': behaviorId,
    ...(strategy !== undefined ? { 'data-nib-defer': strategy } : {}),
  })
}

/**
 * Adds route-scoped browser behavior to one existing static element.
 *
 * `name="search"` maps directly to `src/behaviors/search/index.client.ts`. The
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
