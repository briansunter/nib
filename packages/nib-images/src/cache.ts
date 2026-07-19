import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

interface CachedFile {
  readonly bytes: number
  readonly hit: boolean
}

const inFlight = new Map<string, Promise<CachedFile>>()

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

async function readValidCache(file: string): Promise<{ bytes: number } | undefined> {
  try {
    const [stat, rawMetadata] = await Promise.all([
      fs.stat(file),
      fs.readFile(`${file}.json`, 'utf8'),
    ])
    const metadata = JSON.parse(rawMetadata) as { version?: unknown; bytes?: unknown; checksum?: unknown }
    if (
      stat.size > 0
      && metadata.version === 1
      && metadata.bytes === stat.size
      && metadata.checksum === await fileChecksum(file)
    ) {
      return { bytes: stat.size }
    }
  } catch {}
  return undefined
}

export async function cachedFile(
  directory: string,
  key: string,
  extension: string,
  create: () => Promise<Buffer>,
): Promise<{ bytes: number; hit: boolean; file: string }> {
  const file = cacheFile(directory, key, extension)
  const existing = inFlight.get(file)
  const work = existing ?? (async () => {
    const existingData = await readValidCache(file)
    if (existingData !== undefined) return { bytes: existingData.bytes, hit: true }
    const data = await create()
    if (data.length === 0) throw new Error('@briansunter/nib-images: encoder returned an empty image')
    await fs.mkdir(path.dirname(file), { recursive: true })
    const temporaryId = `${process.pid}.${Math.random().toString(16).slice(2)}.tmp`
    const temporary = `${file}.${temporaryId}`
    const temporaryMetadata = `${file}.json.${temporaryId}`
    try {
      await Promise.all([
        fs.writeFile(temporary, data),
        fs.writeFile(temporaryMetadata, JSON.stringify({
          version: 1,
          bytes: data.length,
          checksum: checksum(data),
        })),
      ])
      await fs.rename(temporary, file)
      await fs.rename(temporaryMetadata, `${file}.json`)
    } finally {
      await Promise.all([
        fs.rm(temporary, { force: true }),
        fs.rm(temporaryMetadata, { force: true }),
      ])
    }
    return { bytes: data.length, hit: false }
  })()
  if (!existing) inFlight.set(file, work)
  try {
    const result = await work
    return { ...result, hit: existing === undefined ? result.hit : true, file }
  } finally {
    if (!existing) inFlight.delete(file)
  }
}

export async function cachedBuffer(
  directory: string,
  key: string,
  extension: string,
  create: () => Promise<Buffer>,
): Promise<{ data: Buffer; hit: boolean; file: string }> {
  const cached = await cachedFile(directory, key, extension, create)
  return {
    ...cached,
    data: await fs.readFile(cached.file),
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
