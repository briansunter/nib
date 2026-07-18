import {
  createContext,
  useContext,
  type ComponentClass,
  type ComponentType,
  type ReactNode,
} from 'react'
import { islandFileToId, validateIslandId } from './island-paths'

const ISLAND_DEFINITION = Symbol.for('nib.island-definition')

export type HydrationStrategy = 'load' | 'idle' | 'visible'

export interface IslandControlProps {
  hydrate?: HydrationStrategy
}

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
type HasHydrateKey<Props extends object> = Props extends unknown
  ? 'hydrate' extends keyof Props ? true : false
  : never
type DefinitionGuard<Props extends object> = true extends HasHydrateKey<Props>
  ? [error: 'hydrate is reserved for the island hydration strategy']
  : AllPropertiesAreJson<Props> extends true
    ? []
    : [error: 'Island props must be JSON-serializable']

type IslandFunctionComponent = (...args: any[]) => ReactNode | Promise<ReactNode>

export type IslandDefinition<Props extends object = object> = ComponentType<
  Props & IslandControlProps
> & {
  readonly [ISLAND_DEFINITION]: true
  readonly islandId: string
  readonly Component: ComponentType<Props>
}

export interface IslandRenderRequest {
  definition: IslandDefinition<any>
  props: Record<string, unknown>
  hydrate: HydrationStrategy
}

export interface IslandRenderer {
  render(request: IslandRenderRequest): ReactNode
}

export const IslandRenderContext = createContext<IslandRenderer | null>(null)

function isHydrationStrategy(value: unknown): value is HydrationStrategy {
  return value === 'load' || value === 'idle' || value === 'visible'
}

export function defineIsland<Props extends object>(
  id: string,
  Component: (props: Props) => ReactNode | Promise<ReactNode>,
  ..._guard: DefinitionGuard<Props>
): IslandDefinition<Props>
export function defineIsland<Component extends IslandFunctionComponent>(
  id: string,
  Component: Component & (Parameters<Component> extends [] ? unknown : never),
): IslandDefinition<Record<never, never>>
export function defineIsland<Props extends object>(
  id: string,
  Component: ComponentClass<Props>,
  ..._guard: DefinitionGuard<Props>
): IslandDefinition<Props>
export function defineIsland<Props extends object>(
  id: string,
  Component: ComponentType<Props>,
  ..._guard: unknown[]
): IslandDefinition<Props> {
  const islandId = validateIslandId(id)
  let definition: IslandDefinition<Props>

  function IslandBoundary(receivedProps: Props & IslandControlProps) {
    const renderer = useContext(IslandRenderContext)
    if (!renderer) {
      throw new Error(`Island ${islandId} must be rendered by Nib`)
    }

    const { hydrate = 'load', ...props } = receivedProps
    if (!isHydrationStrategy(hydrate)) {
      throw new Error(`Invalid hydration strategy for island ${islandId}: ${String(hydrate)}`)
    }

    return renderer.render({
      definition: definition as IslandDefinition<any>,
      props: props as Record<string, unknown>,
      hydrate,
    })
  }

  definition = Object.assign(IslandBoundary, {
    [ISLAND_DEFINITION]: true as const,
    islandId,
    Component,
  })
  return definition
}

export function isIslandDefinition(value: unknown): value is IslandDefinition<any> {
  return typeof value === 'function'
    && (value as Partial<IslandDefinition<any>>)[ISLAND_DEFINITION] === true
    && typeof (value as Partial<IslandDefinition<any>>).islandId === 'string'
    && typeof (value as Partial<IslandDefinition<any>>).Component === 'function'
}

export interface IslandModule {
  default: unknown
}

export function validateIslandModule(file: string, module: IslandModule): IslandDefinition<any> {
  const expectedId = islandFileToId(file)
  if (!isIslandDefinition(module.default)) {
    throw new Error(`Island module ${file} must default-export defineIsland(...)`)
  }
  if (module.default.islandId !== expectedId) {
    throw new Error(
      `Island ID mismatch for ${file}: expected ${expectedId}, received ${module.default.islandId}`,
    )
  }
  return module.default
}

export function validateIslandModules(
  modules: Record<string, IslandModule>,
): Map<string, IslandDefinition<any>> {
  const definitions = new Map<string, IslandDefinition<any>>()
  for (const [file, module] of Object.entries(modules)) {
    const definition = validateIslandModule(file, module)
    if (definitions.has(definition.islandId)) {
      throw new Error(`Duplicate island ID: ${definition.islandId}`)
    }
    definitions.set(definition.islandId, definition)
  }
  return definitions
}

export function nestedIslandRenderer(parentId: string): IslandRenderer {
  return {
    render(request) {
      throw new Error(
        `Island ${request.definition.islandId} cannot be nested inside island ${parentId}`,
      )
    },
  }
}
