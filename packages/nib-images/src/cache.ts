import fs from 'node:fs/promises'
import path from 'node:path'

const inFlight = new Map<string, Promise<{ data: Buffer; hit: boolean }>>()

function cacheFile(directory: string, key: string, extension: string): string {
  return path.join(directory, key.slice(0, 2), `${key}.${extension}`)
}

export async function cachedBuffer(
  directory: string,
  key: string,
  extension: string,
  create: () => Promise<Buffer>,
): Promise<{ data: Buffer; hit: boolean; file: string }> {
  const file = cacheFile(directory, key, extension)
  const existing = inFlight.get(file)
  const work = existing ?? (async () => {
    try {
      const data = await fs.readFile(file)
      if (data.length > 0) return { data, hit: true }
    } catch {}
    const data = await create()
    if (data.length === 0) throw new Error('@briansunter/nib-images: encoder returned an empty image')
    await fs.mkdir(path.dirname(file), { recursive: true })
    const temporary = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`
    await fs.writeFile(temporary, data)
    await fs.rename(temporary, file)
    return { data, hit: false }
  })()
  if (!existing) inFlight.set(file, work)
  try {
    const result = await work
    return { ...result, file }
  } finally {
    if (!existing) inFlight.delete(file)
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
