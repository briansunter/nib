import { createReadStream, type BigIntStats } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * Format-neutral persistent build cache. Mirrors the proven nib-images cache
 * (in-flight dedup, SHA-256 content verification, atomic temp+rename writes,
 * sharded layout with a JSON metadata sidecar) but carries no image-specific
 * dependencies — only node:crypto + node:fs. Plugins opt in via context.cache;
 * plugins that ignore it are unaffected.
 */
export interface CacheEntryOptions {
  /** Flat namespace identifier, e.g. 'personal-site-og'. */
  readonly namespace: string
  /** 64-hex-character SHA-256 key (plugin-supplied, deterministic). */
  readonly key: string
  /** Output extension, e.g. 'png'. */
  readonly extension: string
}

export interface NibBuildCache {
  /**
   * Returns cached bytes, generating them on miss. In-flight deduped per
   * namespace+key+extension.
   */
  buffer(
    options: CacheEntryOptions & { generate: () => Promise<Uint8Array> },
  ): Promise<{ data: Uint8Array; hit: boolean }>
  /** Returns the on-disk cache file path, generating it on miss. */
  file(
    options: CacheEntryOptions & { generate: () => Promise<Uint8Array> },
  ): Promise<{ file: string; hit: boolean }>
}

export type CacheVerification = 'metadata' | 'checksum'

interface ResolveOptions extends CacheEntryOptions {
  readonly generate: () => Promise<Uint8Array>
  readonly verification?: CacheVerification
}

interface ResolvedEntry {
  readonly file: string
  readonly hit: boolean
}

interface CacheMetadata {
  readonly version: 1
  readonly bytes: number
  readonly checksum: string
  readonly device: string
  readonly inode: string
  readonly mtimeNs: string
}

const inFlight = new Map<string, Promise<ResolvedEntry>>()
const accessRefreshIntervalMs = 24 * 60 * 60 * 1_000

function assertNamespace(namespace: string): void {
  if (typeof namespace !== 'string' || !/^[A-Za-z0-9._-]+$/.test(namespace)) {
    throw new Error(
      `nib build cache namespace must be a flat identifier (A-Z a-z 0-9 . _ -): ${String(namespace)}`,
    )
  }
}

function assertKey(key: string): void {
  if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) {
    throw new Error(`nib build cache key must be 64 lowercase hex characters: ${String(key)}`)
  }
}

function assertExtension(extension: string): void {
  if (typeof extension !== 'string' || !/^[a-z0-9]+$/.test(extension)) {
    throw new Error(`nib build cache extension must be lowercase alphanumeric: ${String(extension)}`)
  }
}

function entryFile(
  cacheDirectory: string,
  namespace: string,
  key: string,
  extension: string,
): string {
  return path.join(cacheDirectory, namespace, key.slice(0, 2), `${key}.${extension}`)
}

function checksum(data: Uint8Array): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

async function fileChecksum(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    createReadStream(file)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
  })
}

function validChecksum(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
}

function cacheMetadata(stat: BigIntStats, bytes: number, digest: string): CacheMetadata {
  return {
    version: 1,
    bytes,
    checksum: digest,
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    mtimeNs: stat.mtimeNs.toString(),
  }
}

async function writeMetadata(
  file: string,
  metadata: CacheMetadata,
  temporaryId: string,
): Promise<void> {
  const metadataFile = `${file}.json`
  const temporary = `${metadataFile}.${temporaryId}`
  try {
    await fs.writeFile(temporary, JSON.stringify(metadata))
    await fs.rename(temporary, metadataFile)
  } finally {
    await fs.rm(temporary, { force: true })
  }
}

async function refreshAccessTime(metadataFile: string, modifiedAt: number): Promise<void> {
  if (Date.now() - modifiedAt < accessRefreshIntervalMs) return
  const now = new Date()
  await fs.utimes(metadataFile, now, now).catch(() => undefined)
}

async function readValidCache(
  file: string,
  verification: CacheVerification,
): Promise<{ bytes: number } | undefined> {
  try {
    const metadataFile = `${file}.json`
    const [stat, metadataStat, rawMetadata] = await Promise.all([
      fs.stat(file, { bigint: true }),
      fs.stat(metadataFile),
      fs.readFile(metadataFile, 'utf8'),
    ])
    const metadata = JSON.parse(rawMetadata) as Partial<CacheMetadata> & { version?: unknown }
    const bytes = Number(stat.size)
    if (
      stat.size <= 0
      || !Number.isSafeInteger(bytes)
      || metadata.bytes !== bytes
      || !validChecksum(metadata.checksum)
    ) {
      return undefined
    }
    const identityMatches = metadata.version === 1
      && metadata.device === stat.dev.toString()
      && metadata.inode === stat.ino.toString()
      && metadata.mtimeNs === stat.mtimeNs.toString()
    if (verification === 'metadata' && identityMatches) {
      await refreshAccessTime(metadataFile, metadataStat.mtimeMs)
      return { bytes }
    }
    if (metadata.checksum !== await fileChecksum(file)) return undefined
    if (!identityMatches) {
      await writeMetadata(
        file,
        cacheMetadata(stat, bytes, metadata.checksum),
        `${process.pid}.${Math.random().toString(16).slice(2)}.tmp`,
      )
    } else {
      await refreshAccessTime(metadataFile, metadataStat.mtimeMs)
    }
    return { bytes }
  } catch {
    return undefined
  }
}

async function resolveEntry(cacheDirectory: string, options: ResolveOptions): Promise<ResolvedEntry> {
  assertNamespace(options.namespace)
  assertKey(options.key)
  assertExtension(options.extension)
  const verification: CacheVerification = options.verification ?? 'metadata'
  const file = entryFile(cacheDirectory, options.namespace, options.key, options.extension)
  const inFlightKey = `${options.namespace}:${options.key}:${options.extension}`
  const existing = inFlight.get(inFlightKey)
  const work = existing ?? (async (): Promise<ResolvedEntry> => {
    if ((await readValidCache(file, verification)) !== undefined) return { file, hit: true }
    const data = await options.generate()
    if (data.length === 0) throw new Error('nib build cache generate() returned empty output')
    await fs.mkdir(path.dirname(file), { recursive: true })
    const temporaryId = `${process.pid}.${Math.random().toString(16).slice(2)}.tmp`
    const temporary = `${file}.${temporaryId}`
    try {
      await fs.writeFile(temporary, data)
      await fs.rename(temporary, file)
      const stat = await fs.stat(file, { bigint: true })
      await writeMetadata(file, cacheMetadata(stat, data.length, checksum(data)), temporaryId)
    } finally {
      await fs.rm(temporary, { force: true })
    }
    return { file, hit: false }
  })()
  if (!existing) inFlight.set(inFlightKey, work)
  try {
    const result = await work
    return { file: result.file, hit: existing === undefined ? result.hit : true }
  } finally {
    if (!existing) inFlight.delete(inFlightKey)
  }
}

export function createBuildCache(cacheDirectory: string): NibBuildCache {
  return {
    async buffer(options) {
      const resolved = await resolveEntry(cacheDirectory, options)
      return {
        data: await fs.readFile(resolved.file),
        hit: resolved.hit,
      }
    },
    file(options) {
      return resolveEntry(cacheDirectory, options)
    },
  }
}

/**
 * Builds a deterministic 64-hex SHA-256 cache key from a stable JSON
 * serialization of `parts` (or a raw string), so plugins can derive keys
 * from their inputs without reimplementing hashing.
 */
export function cacheKey(parts: Record<string, unknown> | string): string {
  const input = typeof parts === 'string' ? parts : JSON.stringify(stableSort(parts))
  return crypto.createHash('sha256').update(input).digest('hex')
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort)
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableSort((value as Record<string, unknown>)[key])
        return acc
      }, {})
  }
  return value
}
