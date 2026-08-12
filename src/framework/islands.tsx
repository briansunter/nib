import {
  createContext,
  createElement,
  useContext,
  type ComponentClass,
  type ReactNode,
} from 'react'
import { islandFileToId, validateIslandId } from './island-paths'
import type { JsonSerializableObject } from './island-serialization'
import {
  isIslandHydrationStrategy,
  type IslandHydrationStrategy,
} from './island-strategy'

export type { IslandHydrationStrategy } from './island-strategy'

const ISLAND_DEFINITION = Symbol.for('nib.island-definition')
const ASSIGN_ISLAND_ID = Symbol.for('nib.assign-island-id')
const ISLAND_ID = Symbol.for('nib.island-id')
const ISLAND_COMPONENT = Symbol.for('nib.island-component')

type SyncReactNode = Exclude<ReactNode, Promise<unknown>>

export interface IslandOptions {
  /** Fixed hydration policy for every instance of this island. */
  readonly when?: IslandHydrationStrategy
}

type DefinitionGuard<Props extends object> = JsonSerializableObject<Props> extends true
  ? []
  : [error: 'Island props must be JSON-serializable']

type IslandFunctionComponent<Props extends object = object> = (
  props: Props,
) => SyncReactNode
type IslandComponent<Props extends object = object> =
  | IslandFunctionComponent<Props>
  | ComponentClass<Props>

export type IslandDefinition<Props extends object = object> = IslandFunctionComponent<Props> & {
  readonly when: IslandHydrationStrategy
}

type InternalIslandDefinition<Props extends object = object> = IslandDefinition<Props> & {
  readonly [ISLAND_DEFINITION]: true
  readonly [ISLAND_ID]: string
  readonly [ISLAND_COMPONENT]: IslandComponent<Props>
  /** @internal Assigned from the module path for `island(Component)`. */
  readonly [ASSIGN_ISLAND_ID]: (id: string) => void
}

export interface IslandRenderRequest {
  definition: IslandDefinition<any>
  props: Record<string, unknown>
  when: IslandHydrationStrategy
}

export interface IslandRenderer {
  render(request: IslandRenderRequest): SyncReactNode
}

export const IslandRenderContext = createContext<IslandRenderer | null>(null)

export function island<Props extends object>(
  Component: IslandFunctionComponent<Props>,
  options?: IslandOptions,
  ..._guard: DefinitionGuard<Props>
): IslandDefinition<Props>
export function island<Component extends IslandFunctionComponent<Record<never, never>>>(
  Component: Component & (Parameters<Component> extends [] ? unknown : never),
  options?: IslandOptions,
): IslandDefinition<Record<never, never>>
export function island<Props extends object>(
  Component: ComponentClass<Props>,
  options?: IslandOptions,
  ..._guard: DefinitionGuard<Props>
): IslandDefinition<Props>
export function island<Props extends object>(
  Component: IslandComponent<Props>,
  options: IslandOptions = {},
  ..._guard: unknown[]
): IslandDefinition<Props> {
  const when = options.when ?? 'load'
  if (!isIslandHydrationStrategy(when)) {
    throw new Error(`Invalid island hydration strategy: ${String(when)}`)
  }
  return createIslandDefinition(Component, when)
}

function createIslandDefinition<Props extends object>(
  Component: IslandComponent<Props>,
  when: IslandHydrationStrategy,
): IslandDefinition<Props> {
  let islandId: string | undefined
  let definition: InternalIslandDefinition<Props>

  function IslandBoundary(receivedProps: Props) {
    const renderer = useContext(IslandRenderContext)
    if (renderer === null) {
      if (islandId === undefined) {
        throw new Error(
          'island(Component) must be the default export of a module under src/islands',
        )
      }
      throw new Error(`Island ${islandId} must be rendered by Nib`)
    }
    return renderer.render({
      definition: definition as IslandDefinition<any>,
      props: receivedProps as Record<string, unknown>,
      when,
    })
  }

  definition = Object.assign(IslandBoundary, {
    [ISLAND_DEFINITION]: true as const,
    when,
    [ASSIGN_ISLAND_ID](id: string) {
      const nextId = validateIslandId(id)
      if (islandId !== undefined && islandId !== nextId) {
        throw new Error(`Island ID mismatch: expected ${nextId}, received ${islandId}`)
      }
      islandId = nextId
    },
  }) as InternalIslandDefinition<Props>
  Object.defineProperty(definition, ISLAND_ID, {
    configurable: false,
    enumerable: false,
    get: () => islandId ?? '',
  })
  Object.defineProperty(definition, ISLAND_COMPONENT, {
    configurable: false,
    enumerable: false,
    value: Component,
  })
  return definition
}

export function isIslandDefinition(value: unknown): value is IslandDefinition<any> {
  return typeof value === 'function'
    && (value as Partial<InternalIslandDefinition<any>>)[ISLAND_DEFINITION] === true
    && typeof (value as Partial<InternalIslandDefinition<any>>)[ISLAND_ID] === 'string'
    && typeof (value as Partial<InternalIslandDefinition<any>>)[ISLAND_COMPONENT] === 'function'
    && isIslandHydrationStrategy((value as Partial<IslandDefinition<any>>).when)
}

export function islandDefinitionId(definition: IslandDefinition<any>): string {
  return (definition as InternalIslandDefinition<any>)[ISLAND_ID]
}

export function islandDefinitionComponent(
  definition: IslandDefinition<any>,
): IslandComponent<any> {
  return (definition as InternalIslandDefinition<any>)[ISLAND_COMPONENT]
}

export interface IslandModule {
  default: unknown
}

export function validateIslandModule(
  file: string,
  module: IslandModule,
): IslandDefinition<any> {
  const expectedId = islandFileToId(file)
  if (!isIslandDefinition(module.default)) {
    throw new Error(`Island module ${file} must default-export island(...)`)
  }
  const definition = module.default as InternalIslandDefinition<any>
  if (islandDefinitionId(definition) === '') {
    definition[ASSIGN_ISLAND_ID](expectedId)
  }
  if (islandDefinitionId(definition) !== expectedId) {
    throw new Error(
      `Island ID mismatch for ${file}: expected ${expectedId}, received ${islandDefinitionId(definition)}`,
    )
  }
  return definition
}

export function validateIslandModules(
  modules: Record<string, IslandModule>,
): Map<string, IslandDefinition<any>> {
  const definitions = new Map<string, IslandDefinition<any>>()
  for (const [file, module] of Object.entries(modules)) {
    const definition = validateIslandModule(file, module)
    const id = islandDefinitionId(definition)
    if (definitions.has(id)) {
      throw new Error(`Duplicate island ID: ${id}`)
    }
    definitions.set(id, definition)
  }
  return definitions
}

/** Renders nested island definitions as ordinary children of the owning root. */
export function composedIslandRenderer(): IslandRenderer {
  return {
    render(request) {
      return createElement(islandDefinitionComponent(request.definition), request.props)
    },
  }
}
