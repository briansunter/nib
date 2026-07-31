import { createContext } from 'react'

export interface ClientOwner {
  kind: 'behavior' | 'island'
  name: string
}

/**
 * Tracks which client runtime owns the current subtree during server render.
 * Behaviors may compose, but an island and a behavior may not overlap.
 */
export const ClientOwnershipContext = createContext<ClientOwner | null>(null)

export class ClientOwnershipError extends Error {
  readonly child: ClientOwner
  readonly parent: ClientOwner

  constructor(child: ClientOwner, parent: ClientOwner) {
    super(
      `Client ownership conflict: ${child.kind} ${JSON.stringify(child.name)} `
      + `cannot be nested inside ${parent.kind} ${JSON.stringify(parent.name)}. `
      + 'Use sibling boundaries or let one client module own the subtree.',
    )
    this.name = 'ClientOwnershipError'
    this.child = child
    this.parent = parent
  }
}

export function clientOwnershipError(
  child: ClientOwner,
  parent: ClientOwner,
): Error {
  return new ClientOwnershipError(child, parent)
}
