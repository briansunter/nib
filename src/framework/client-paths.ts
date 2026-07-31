const CLIENT_ID_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Normalize and validate a slash-separated client runtime ID. */
export function validateClientId(id: unknown, kind: 'island' | 'behavior'): string {
  if (typeof id !== 'string') {
    throw new Error(`Invalid ${kind} ID: ${String(id)}`)
  }
  const normalized = id.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
  if (!normalized || normalized.split('/').some((segment) => !CLIENT_ID_SEGMENT.test(segment))) {
    throw new Error(`Invalid ${kind} ID: ${id}`)
  }
  return normalized
}
