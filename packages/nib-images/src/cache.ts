import { createReadStream, type BigIntStats } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

interface CachedFile {
  readonly bytes: number
  readonly hit: boolean
}

export type CacheVerification = 'metadata' | 'checksum'

export interface CacheLimits {
  readonly maxBytes: number
  readonly maxEntries: number
}

export interface CachePruneResult {
  readonly entries: number
  readonly bytes: number
}

interface CacheMetadata {
  readonly version: 2
  readonly bytes: number
  readonly checksum: string
  readonly device: string
  readonly inode: string
  readonly mtimeNs: string
}

interface CacheEntry {
  readonly key: string
  readonly file: string
  readonly metadataFile: string
  readonly bytes: number
  readonly accessedAt: number
}

const inFlight = new Map<string, Promise<CachedFile>>()
const pruneInFlight = new Map<string, Promise<CachePruneResult>>()
const accessRefreshIntervalMs = 24 * 60 * 60 * 1_000

function cacheFile(directory: string, key: string, extension: string): string {
  return path.join(directory, key.slice(0, 2), `${key}.${extension}`)
}

function checksum(data: Buffer): string {
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

function cacheMetadata(
  stat: BigIntStats,
  bytes: number,
  digest: string,
): CacheMetadata {
  return {
    version: 2,
    bytes,
    checksum: digest,
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    mtimeNs: stat.mtimeNs.toString(),
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
    if (stat.size <= 0 || !Number.isSafeInteger(bytes) || metadata.bytes !== bytes || !validChecksum(metadata.checksum)) {
      return undefined
    }
    const identityMatches = metadata.version === 2
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
  } catch {}
  return undefined
}

export async function cachedFile(
  directory: string,
  key: string,
  extension: string,
  create: () => Promise<Buffer>,
  verification: CacheVerification = 'metadata',
): Promise<{ bytes: number; hit: boolean; file: string }> {
  const file = cacheFile(directory, key, extension)
  const inFlightKey = `${file}:${verification}`
  const existing = inFlight.get(inFlightKey)
  const work = existing ?? (async () => {
    const existingData = await readValidCache(file, verification)
    if (existingData !== undefined) return { bytes: existingData.bytes, hit: true }
    const data = await create()
    if (data.length === 0) throw new Error('@briansunter/nib-images: encoder returned an empty image')
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
    return { bytes: data.length, hit: false }
  })()
  if (!existing) inFlight.set(inFlightKey, work)
  try {
    const result = await work
    return { ...result, hit: existing === undefined ? result.hit : true, file }
  } finally {
    if (!existing) inFlight.delete(inFlightKey)
  }
}

export async function cachedBuffer(
  directory: string,
  key: string,
  extension: string,
  create: () => Promise<Buffer>,
  verification: CacheVerification = 'metadata',
): Promise<{ data: Buffer; hit: boolean; file: string }> {
  const cached = await cachedFile(directory, key, extension, create, verification)
  return {
    ...cached,
    data: await fs.readFile(cached.file),
  }
}

async function cacheEntries(directory: string): Promise<CacheEntry[]> {
  const shards = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  const entries: CacheEntry[] = []
  for (const shard of shards) {
    if (!shard.isDirectory() || !/^[a-f0-9]{2}$/.test(shard.name)) continue
    const shardDirectory = path.join(directory, shard.name)
    const names = await fs.readdir(shardDirectory).catch(() => [])
    const candidates = await Promise.all(names
      .filter((name) => /^[a-f0-9]{64}\.[a-z0-9]+$/.test(name))
      .map(async (name): Promise<CacheEntry | undefined> => {
        const file = path.join(shardDirectory, name)
        const metadataFile = `${file}.json`
        const [stat, metadataStat] = await Promise.all([
          fs.stat(file).catch(() => undefined),
          fs.stat(metadataFile).catch(() => undefined),
        ])
        if (!stat?.isFile() || !metadataStat?.isFile()) return undefined
        return {
          key: name.slice(0, 64),
          file,
          metadataFile,
          bytes: stat.size + metadataStat.size,
          accessedAt: metadataStat.mtimeMs,
        }
      }))
    entries.push(...candidates.filter((entry): entry is CacheEntry => entry !== undefined))
  }
  return entries
}

/**
 * Removes the least-recently-used complete cache entries until both limits
 * hold. Cache entries are disposable; linked build output remains intact.
 */
export async function pruneImageCache(
  directory: string,
  limits: CacheLimits,
  protectedKeys: ReadonlySet<string> = new Set(),
): Promise<CachePruneResult> {
  const resolvedDirectory = path.resolve(directory)
  const existing = pruneInFlight.get(resolvedDirectory)
  if (existing) return existing
  const work = (async () => {
    const entries = (await cacheEntries(resolvedDirectory))
      .sort((left, right) => left.accessedAt - right.accessedAt || left.file.localeCompare(right.file))
    let retainedEntries = entries.length
    let retainedBytes = entries.reduce((total, entry) => total + entry.bytes, 0)
    const remove: CacheEntry[] = []
    for (const entry of entries) {
      if (retainedEntries <= limits.maxEntries && retainedBytes <= limits.maxBytes) break
      if (protectedKeys.has(entry.key)) continue
      remove.push(entry)
      retainedEntries -= 1
      retainedBytes -= entry.bytes
    }
    for (let offset = 0; offset < remove.length; offset += 64) {
      await Promise.all(remove.slice(offset, offset + 64).flatMap((entry) => [
        fs.rm(entry.file, { force: true }),
        fs.rm(entry.metadataFile, { force: true }),
      ]))
    }
    return {
      entries: remove.length,
      bytes: remove.reduce((total, entry) => total + entry.bytes, 0),
    }
  })()
  pruneInFlight.set(resolvedDirectory, work)
  try {
    return await work
  } finally {
    pruneInFlight.delete(resolvedDirectory)
  }
}

export async function linkOrCopy(source: string, target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.rm(target, { force: true })
  try {
    await fs.link(source, target)
  } catch {
    await fs.copyFile(source, target)
  }
}
