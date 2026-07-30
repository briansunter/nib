export type ClientMountStrategy = 'load' | 'idle' | 'visible'

/** @deprecated alias kept for island-side hydration terminology; prefer ClientMountStrategy. */
export type HydrationStrategy = ClientMountStrategy

export function isClientMountStrategy(value: unknown): value is ClientMountStrategy {
  return value === 'load' || value === 'idle' || value === 'visible'
}

/** @deprecated alias kept for back-compat. */
export const isHydrationStrategy = isClientMountStrategy
