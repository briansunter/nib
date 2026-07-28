import {
  createContext,
  createElement,
  useContext,
  type ComponentType,
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

const BEHAVIOR_DEFINITION = Symbol.for('nib.behavior-definition')

/** @internal Collects framework-authored behavior markers during SSR. */
export const BehaviorRenderContext = createContext<Set<string> | null>(null)

type DefinitionGuard<Props extends object> = JsonSerializableObject<Props> extends true
  ? []
  : [error: 'Behavior props must be JSON-serializable']

interface BehaviorControlProps {
  hydrate?: HydrationStrategy
  children?: ReactNode
}

export type ClientBehaviorProps<Props extends object> = keyof Props extends never
  ? BehaviorControlProps & { props?: Props }
  : BehaviorControlProps & { props: Props }

export type ClientBehaviorDefinition<Props extends object = object> = ComponentType<
  ClientBehaviorProps<Props>
> & {
  readonly [BEHAVIOR_DEFINITION]: true
  readonly behaviorId: string
}

/**
 * Declares a server-safe progressive enhancement boundary. The browser
 * implementation is discovered separately from `src/behaviors/*.client.ts`.
 */
export function defineClientBehavior(
  id: string,
): ClientBehaviorDefinition<Record<never, never>>
export function defineClientBehavior<Props extends object>(
  id: string,
  ..._guard: DefinitionGuard<Props>
): ClientBehaviorDefinition<Props>
export function defineClientBehavior(
  id: string,
  ..._guard: readonly unknown[]
): unknown {
  const behaviorId = validateIslandId(id)
  function BehaviorBoundary(received: BehaviorControlProps & { props?: object }) {
    useContext(BehaviorRenderContext)?.add(behaviorId)
    const { props = {}, hydrate = 'load', children } = received
    if (!isHydrationStrategy(hydrate)) {
      throw new Error(`Invalid hydration strategy for behavior ${behaviorId}: ${String(hydrate)}`)
    }
    return createElement('nib-behavior', {
      'data-behavior': behaviorId,
      'data-hydrate': hydrate,
      'data-props': serializeIslandProps(props),
      style: { display: 'contents' },
    }, children)
  }
  return Object.assign(BehaviorBoundary, {
    [BEHAVIOR_DEFINITION]: true as const,
    behaviorId,
  })
}
