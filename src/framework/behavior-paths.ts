import { validateIslandId } from './island-paths'

/**
 * All `.client` modules under `src/` are discoverable: those under `src/behaviors/`
 * keep a readable relative id; co-located modules (anywhere else under `src/`)
 * get a stable hash id so `<Enhance behavior={module}>` can resolve them.
 */
export const BEHAVIOR_MODULE_GLOB =
  '/src/**/*.client.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'

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

/** Deterministic lowercase hex hash (djb2) — pure JS, runs in browser + Node. */
function hashPath(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
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
  if (markerIndex >= 0) {
    return validateIslandId(withoutExtension.slice(markerIndex + marker.length))
  }
  // Co-located module: stable hash id (the source path may contain uppercase or
  // other characters that are not valid island-id segments).
  return `colocated-${hashPath(withoutExtension)}`
}
