import {
  createContext,
  createElement,
  useContext,
  type ComponentClass,
  type ReactNode,
} from 'react'
import {
  isHydrationStrategy,
  type HydrationStrategy,
} from './hydration'
import { islandFileToId, validateIslandId } from './island-paths'
import type { JsonSerializableObject } from './island-serialization'
import {
  ClientOwnershipContext,
  clientOwnershipError,
} from './client-ownership'

export type { HydrationStrategy } from './hydration'

const ISLAND_DEFINITION = Symbol.for('nib.island-definition')
const ASSIGN_ISLAND_ID = Symbol.for('nib.assign-island-id')

type SyncReactNode = Exclude<ReactNode, Promise<unknown>>

export interface IslandControlProps {
  /** When to hydrate this island in the browser. */
  when?: HydrationStrategy
}

type HasControlKey<Props extends object> = Props extends unknown
  ? 'when' extends keyof Props ? true : false
  : never
type DefinitionGuard<Props extends object> = true extends HasControlKey<Props>
  ? [error: 'when is reserved for the island hydration strategy']
  : JsonSerializableObject<Props> extends true
    ? []
    : [error: 'Island props must be JSON-serializable']

type IslandFunctionComponent<Props extends object = object> = (props: Props) => SyncReactNode
type IslandComponent<Props extends object = object> =
  | IslandFunctionComponent<Props>
  | ComponentClass<Props>

export type IslandDefinition<Props extends object = object> = IslandFunctionComponent<
  Props & IslandControlProps
> & {
  readonly [ISLAND_DEFINITION]: true
  readonly islandId: string
  readonly Component: IslandComponent<Props>
  /** @internal Assigned from the module path for `island(Component)`. */
  readonly [ASSIGN_ISLAND_ID]: (id: string) => void
}

export interface IslandRenderRequest {
  definition: IslandDefinition<any>
  props: Record<string, unknown>
  when: HydrationStrategy
}

export interface IslandRenderer {
  render(request: IslandRenderRequest): SyncReactNode
}

export const IslandRenderContext = createContext<IslandRenderer | null>(null)

export function island<Props extends object>(
  Component: IslandFunctionComponent<Props>,
  ..._guard: DefinitionGuard<Props>
): IslandDefinition<Props>
export function island<Component extends IslandFunctionComponent<Record<never, never>>>(
  Component: Component & (Parameters<Component> extends [] ? unknown : never),
): IslandDefinition<Record<never, never>>
export function island<Props extends object>(
  Component: ComponentClass<Props>,
  ..._guard: DefinitionGuard<Props>
): IslandDefinition<Props>
export function island<Props extends object>(
  Component: IslandComponent<Props>,
  ..._guard: unknown[]
): IslandDefinition<Props> {
  return createIslandDefinition(Component)
}

function createIslandDefinition<Props extends object>(
  Component: IslandComponent<Props>,
): IslandDefinition<Props> {
  let islandId: string | undefined
  let definition: IslandDefinition<Props>

  function IslandBoundary(receivedProps: Props & IslandControlProps) {
    const owner = useContext(ClientOwnershipContext)
    if (islandId === undefined && owner?.kind !== 'island') {
      throw new Error(
        'island(Component) must be the default export of a module under src/islands',
      )
    }
    if (owner?.kind === 'behavior') {
      throw clientOwnershipError(
        { kind: 'island', name: islandId ?? 'unregistered' },
        owner,
      )
    }
    const renderer = useContext(IslandRenderContext)
    if (!renderer) {
      throw new Error(`Island ${islandId} must be rendered by Nib`)
    }

    const { when = 'load', ...props } = receivedProps
    if (!isHydrationStrategy(when)) {
      throw new Error(`Invalid hydration strategy for island ${islandId}: ${String(when)}`)
    }

    return renderer.render({
      definition: definition as IslandDefinition<any>,
      props: props as Record<string, unknown>,
      when,
    })
  }

  definition = Object.assign(IslandBoundary, {
    [ISLAND_DEFINITION]: true as const,
    Component,
    [ASSIGN_ISLAND_ID](id: string) {
      const nextId = validateIslandId(id)
      if (islandId !== undefined && islandId !== nextId) {
        throw new Error(`Island ID mismatch: expected ${nextId}, received ${islandId}`)
      }
      islandId = nextId
    },
  }) as IslandDefinition<Props>
  Object.defineProperty(definition, 'islandId', {
    configurable: false,
    enumerable: true,
    get: () => islandId ?? '',
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
    throw new Error(
      `Island module ${file} must default-export island(...)`,
    )
  }
  if (module.default.islandId === '') {
    module.default[ASSIGN_ISLAND_ID](expectedId)
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

export function composedIslandRenderer(): IslandRenderer {
  return {
    render(request) {
      return createElement(request.definition.Component, request.props)
    },
  }
}
