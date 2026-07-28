import { createElement, type ComponentType, type ReactNode } from 'react'
import { serializeIslandProps } from './island-serialization'
import { validateIslandId } from './island-paths'
import type { HydrationStrategy } from './islands'

const BEHAVIOR_DEFINITION = Symbol.for('nib.behavior-definition')

type IsAny<Value> = 0 extends (1 & Value) ? true : false
type IsBroadObject<Value> = [Value] extends [object]
  ? [object] extends [Value] ? true : false
  : false
type IsOptionalKey<Value extends object, Key extends keyof Value> = {} extends Pick<Value, Key>
  ? true
  : false
type AllPropertiesAreJson<Value extends object> = Value extends unknown
  ? IsBroadObject<Value> extends true
    ? false
    : keyof Value extends never
      ? true
      : false extends {
          [Key in keyof Value]-?: IsOptionalKey<Value, Key> extends true
            ? IsJsonValue<Exclude<Value[Key], undefined>>
            : IsJsonValue<Value[Key]>
        }[keyof Value]
        ? false
        : true
  : never
type IsJsonValue<Value> = IsAny<Value> extends true
  ? false
  : [Value] extends [never | undefined]
    ? false
    : [Value] extends [null | string | number | boolean]
      ? true
      : Value extends (...args: never[]) => unknown
        ? false
        : Value extends readonly (infer Item)[]
          ? IsJsonValue<Item>
          : Value extends object
            ? AllPropertiesAreJson<Value>
            : false
type DefinitionGuard<Props extends object> = AllPropertiesAreJson<Props> extends true
  ? []
  : [error: 'Behavior props must be JSON-serializable']

export interface ClientBehaviorProps<Props extends object> {
  props: Props
  hydrate?: HydrationStrategy
  children?: ReactNode
}

export type ClientBehaviorDefinition<Props extends object = object> = ComponentType<
  ClientBehaviorProps<Props>
> & {
  readonly [BEHAVIOR_DEFINITION]: true
  readonly behaviorId: string
}

function isHydrationStrategy(value: unknown): value is HydrationStrategy {
  return value === 'load' || value === 'idle' || value === 'visible'
}

/**
 * Declares a server-safe progressive enhancement boundary. The browser
 * implementation is discovered separately from `src/behaviors/*.client.ts`.
 */
export function defineClientBehavior<Props extends object>(
  id: string,
  ..._guard: DefinitionGuard<Props>
): ClientBehaviorDefinition<Props> {
  const behaviorId = validateIslandId(id)
  function BehaviorBoundary({
    props,
    hydrate = 'load',
    children,
  }: ClientBehaviorProps<Props>) {
    if (!isHydrationStrategy(hydrate)) {
      throw new Error(`Invalid hydration strategy for behavior ${behaviorId}: ${String(hydrate)}`)
    }
    return createElement('nib-behavior', {
      'data-behavior': behaviorId,
      'data-hydrate': hydrate,
      'data-props': serializeIslandProps(props),
    }, children)
  }
  return Object.assign(BehaviorBoundary, {
    [BEHAVIOR_DEFINITION]: true as const,
    behaviorId,
  })
}
