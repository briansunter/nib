import { validateClientId } from './client-paths'

/**
 * Only explicit behavior entry modules under `src/behaviors/` are discoverable.
 * Supporting browser modules elsewhere in `src/` must not become behavior
 * entries accidentally.
 */
export const BEHAVIOR_MODULE_GLOB =
  '/src/behaviors/**/*.client.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'

/**
 * Canonicalize any path form (absolute build id or glob key) to the slice from
 * the last `/src/` onward, so the build-time transform and the runtime glob
 * derive the same id from the same module.
 */
function canonicalBehaviorPath(file: string): string {
  const clean = file.replaceAll('\\', '/').split(/[?#]/, 1)[0]!
  const srcIndex = clean.lastIndexOf('/src/')
  return srcIndex >= 0 ? clean.slice(srcIndex) : `/${clean.replace(/^\.?\//, '')}`
}

/** Validate a behavior name without reporting an island-specific error. */
export function validateBehaviorId(id: string): string {
  return validateClientId(id, 'behavior')
}

export function behaviorFileToId(file: string): string {
  const canonical = canonicalBehaviorPath(file)
  const withoutExtension = canonical.replace(
    /\.client\.(?:[cm]?[jt]s|[jt]sx)$/,
    '',
  )
  if (withoutExtension === canonical) {
    throw new Error(
      `Behavior module must use a .client JavaScript or TypeScript filename: ${file}`,
    )
  }
  const marker = '/behaviors/'
  const markerIndex = withoutExtension.lastIndexOf(marker)
  if (markerIndex < 0) {
    throw new Error(`Behavior module must be under src/behaviors: ${file}`)
  }
  return validateBehaviorId(withoutExtension.slice(markerIndex + marker.length))
}
