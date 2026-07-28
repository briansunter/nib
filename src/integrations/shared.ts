import type { CollectionCapability } from '../framework/types'

export function isCollectionCapability<Result>(
  value: unknown,
): value is CollectionCapability<Result> {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as { kind?: unknown }).kind === 'collection-capability'
}

export function resourcePath(value: string, owner: string): string {
  if (
    !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('?')
    || value.includes('#')
  ) {
    throw new Error(`${owner} path must be an absolute route path without query or hash`)
  }
  return value
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
