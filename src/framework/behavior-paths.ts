const BEHAVIOR_ID_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Only explicit behavior entry modules under `src/behaviors/` are discoverable.
 * Supporting browser modules elsewhere in `src/` must not become behavior
 * entries accidentally.
 */
export const BEHAVIOR_MODULE_GLOB =
  '/src/behaviors/**/index.client.{js,ts}'

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

/** Normalize and validate a slash-separated behavior name. */
export function validateBehaviorId(id: string): string {
  if (typeof id !== 'string') {
    throw new Error(`Invalid behavior ID: ${String(id)}`)
  }
  const normalized = id.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
  if (
    !normalized
    || normalized.split('/').some((segment) => !BEHAVIOR_ID_SEGMENT.test(segment))
  ) {
    throw new Error(`Invalid behavior ID: ${id}`)
  }
  return normalized
}

export function behaviorFileToId(file: string): string {
  const canonical = canonicalBehaviorPath(file)
  const match = canonical.match(/\/behaviors\/(.+)\/index\.client\.(?:js|ts)$/)
  if (match === null) {
    throw new Error(
      `Behavior module must be named src/behaviors/<name>/index.client.ts or .js: ${file}`,
    )
  }
  return validateBehaviorId(match[1]!)
}
