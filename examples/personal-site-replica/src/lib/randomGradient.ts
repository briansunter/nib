// Deterministic earth-duotone gradient derived from a string seed.
// Ported from the reference site so missing-cover thumbnails harmonise with
// the warm surface and navy accent. Picks one of five fallback gradients.
const EARTH_DUOTONES = [
  'linear-gradient(135deg, #c8b89a 0%, #6b5b3f 100%)',
  'linear-gradient(135deg, #d4a373 0%, #8b3a3a 100%)',
  'linear-gradient(135deg, #94a3b8 0%, #1e3a5f 100%)',
  'linear-gradient(135deg, #a8b5a0 0%, #3f5b4d 100%)',
  'linear-gradient(135deg, #d6b89a 0%, #5b3a2e 100%)',
] as const

export function randomGradient(seed: string): string {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  }
  const idx = (h >>> 0) % EARTH_DUOTONES.length
  return EARTH_DUOTONES[idx]
}
