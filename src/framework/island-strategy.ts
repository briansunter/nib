export type IslandHydrationStrategy = 'load' | 'visible'

export function isIslandHydrationStrategy(
  value: unknown,
): value is IslandHydrationStrategy {
  return value === 'load' || value === 'visible'
}
