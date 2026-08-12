const ENHANCEMENT_ID_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Only explicit enhancement entry modules under `src/enhancements/` are
 * discoverable. Supporting browser modules elsewhere in `src/` must not
 * become enhancement entries accidentally.
 */
export const ENHANCEMENT_MODULE_GLOB =
  '/src/enhancements/**/index.client.{js,ts}'

/**
 * Canonicalize any path form (absolute build id or glob key) to the slice from
 * the last `/src/` onward, so the build-time transform and the runtime glob
 * derive the same id from the same module.
 */
function canonicalEnhancementPath(file: string): string {
  const clean = file.replaceAll('\\', '/').split(/[?#]/, 1)[0]!
  const srcIndex = clean.lastIndexOf('/src/')
  return srcIndex >= 0 ? clean.slice(srcIndex) : `/${clean.replace(/^\.?\//, '')}`
}

/** Normalize and validate a slash-separated enhancement name. */
export function validateEnhancementId(id: string): string {
  if (typeof id !== 'string') {
    throw new Error(`Invalid enhancement ID: ${String(id)}`)
  }
  const normalized = id.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
  if (
    !normalized
    || normalized.split('/').some((segment) => !ENHANCEMENT_ID_SEGMENT.test(segment))
  ) {
    throw new Error(`Invalid enhancement ID: ${id}`)
  }
  return normalized
}

export function enhancementFileToId(file: string): string {
  const canonical = canonicalEnhancementPath(file)
  const match = canonical.match(/\/enhancements\/(.+)\/index\.client\.(?:js|ts)$/)
  if (match === null) {
    throw new Error(
      `Enhancement module must be named src/enhancements/<name>/index.client.ts or .js: ${file}`,
    )
  }
  return validateEnhancementId(match[1]!)
}
