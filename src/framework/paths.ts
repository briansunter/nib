import { canonicalRoutePath } from './publication'
import type { TrailingSlash } from './types'

export {
  canonicalRoutePath,
  isFileRoute,
  normalizePath,
} from './publication'

const controlCharacterPattern = /[\u0000-\u001F\u007F]/

function hasEncodedUnreservedAscii(value: string): boolean {
  for (const match of value.matchAll(/%([0-9A-Fa-f]{2})/g)) {
    const byte = Number.parseInt(match[1]!, 16)
    if (
      (byte >= 0x30 && byte <= 0x39)
      || (byte >= 0x41 && byte <= 0x5A)
      || (byte >= 0x61 && byte <= 0x7A)
      || byte === 0x2D
      || byte === 0x2E
      || byte === 0x5F
      || byte === 0x7E
    ) return true
  }
  return false
}

/** Validates an authored route identity before applying the slash policy. */
export function normalizeRoutePath(
  value: unknown,
  label: string,
  trailingSlash: TrailingSlash = 'ignore',
): string {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    throw new Error(`${label} must be an absolute route path starting with "/"`)
  }
  if (value.startsWith('//')) {
    throw new Error(`${label} cannot be a protocol-relative URL`)
  }
  if (controlCharacterPattern.test(value)) {
    throw new Error(`${label} must contain no control characters`)
  }
  if (value.includes('?') || value.includes('#') || value.includes('\\')) {
    throw new Error(`${label} must contain no query, hash, or backslash`)
  }
  if (/\/{2,}/.test(value)) {
    throw new Error(`${label} must contain no repeated slashes`)
  }
  for (const segment of value.split('/')) {
    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      throw new Error(`${label} must contain valid URL encoding`)
    }
    if (decoded === '.' || decoded === '..') {
      throw new Error(`${label} must contain no dot segments`)
    }
    if (controlCharacterPattern.test(decoded)) {
      throw new Error(`${label} must contain no encoded control characters`)
    }
    if (decoded.includes('/') || decoded.includes('\\')) {
      throw new Error(`${label} must contain no encoded path separators`)
    }
    if (hasEncodedUnreservedAscii(segment)) {
      throw new Error(`${label} must contain no encoded unreserved characters`)
    }
  }
  return canonicalRoutePath(value, trailingSlash)
}

export function fileToRoute(file: string): string {
  const normalized = file.replaceAll('\\', '/')
  const match = normalized.match(/(?:^|\/)pages\/(.*)\/page\.[A-Za-z0-9]+$/)
    ?? normalized.match(/(?:^|\/)pages\/page\.[A-Za-z0-9]+$/)

  if (!match) throw new Error(`Invalid page file: ${file}`)
  if (!match[1]) return '/'
  return `/${match[1]}`.replace(/\/+/g, '/')
}
