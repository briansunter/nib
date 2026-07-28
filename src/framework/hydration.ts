export type HydrationStrategy = 'load' | 'idle' | 'visible'

export function isHydrationStrategy(value: unknown): value is HydrationStrategy {
  return value === 'load' || value === 'idle' || value === 'visible'
}
