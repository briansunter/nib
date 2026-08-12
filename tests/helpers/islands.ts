import {
  validateIslandModule,
  type IslandDefinition,
} from '../../src/framework/islands'

/** Assigns the same path-derived ID that a project build assigns. */
export function registeredIsland<Definition extends IslandDefinition<any>>(
  id: string,
  definition: Definition,
): Definition {
  validateIslandModule(`/src/islands/${id}.tsx`, { default: definition })
  return definition
}
