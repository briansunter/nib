import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cacheKey, createBuildCache } from '../src/framework/cache'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

async function makeCacheDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-build-cache-'))
  temporaryDirectories.push(directory)
  return directory
}

const VALID_KEY = cacheKey('fixture-key')

describe('createBuildCache.buffer', () => {
  it('generates on first call (miss) and returns cached bytes on second call (hit) without re-running generate', async () => {
    const cacheDirectory = await makeCacheDirectory()
    const cache = createBuildCache(cacheDirectory)

    const calls: string[] = []
    const generate = async (): Promise<Uint8Array> => {
      calls.push('generate')
      return new TextEncoder().encode('hello cache')
    }

    const first = await cache.buffer({ namespace: 'personal-site-og', key: VALID_KEY, extension: 'png', generate })
    expect(first.hit).toBe(false)
    expect(calls).toEqual(['generate'])
    expect(new TextDecoder().decode(first.data)).toBe('hello cache')

    const second = await cache.buffer({ namespace: 'personal-site-og', key: VALID_KEY, extension: 'png', generate })
    expect(second.hit).toBe(true)
    expect(calls).toEqual(['generate'])
    expect(new TextDecoder().decode(second.data)).toBe('hello cache')
    expect(Buffer.isBuffer(second.data)).toBe(true)
  })

  it('treats Buffer output from generate as Uint8Array', async () => {
    const cacheDirectory = await makeCacheDirectory()
    const cache = createBuildCache(cacheDirectory)

    const first = await cache.buffer({
      namespace: 'ns',
      key: VALID_KEY,
      extension: 'bin',
      generate: async () => Buffer.from([0, 1, 2, 3]),
    })
    expect(first.hit).toBe(false)
    expect(Array.from(first.data)).toEqual([0, 1, 2, 3])

    const second = await cache.buffer({
      namespace: 'ns',
      key: VALID_KEY,
      extension: 'bin',
      generate: async () => Buffer.from([9, 9, 9]),
    })
    expect(second.hit).toBe(true)
    expect(Array.from(second.data)).toEqual([0, 1, 2, 3])
  })

  it('dedupes concurrent in-flight calls for the same namespace+key+extension', async () => {
    const cacheDirectory = await makeCacheDirectory()
    const cache = createBuildCache(cacheDirectory)

    let calls = 0
    const generate = async (): Promise<Uint8Array> => {
      calls += 1
      return new TextEncoder().encode('once')
    }

    const options = { namespace: 'concurrent', key: VALID_KEY, extension: 'txt', generate }
    const [a, b] = await Promise.all([cache.buffer(options), cache.buffer(options)])
    expect(calls).toBe(1)
    expect(a.hit).toBe(false)
    // The second awaiting caller observes the freshly produced entry as a hit.
    expect(b.hit).toBe(true)
  })

  it('isolates concurrent in-flight work between cache instances and directories', async () => {
    const firstDirectory = await makeCacheDirectory()
    const secondDirectory = await makeCacheDirectory()
    const firstCache = createBuildCache(firstDirectory)
    const secondCache = createBuildCache(secondDirectory)

    let releaseFirst!: () => void
    const firstCanFinish = new Promise<void>((resolve) => { releaseFirst = resolve })
    let firstStarted!: () => void
    const firstDidStart = new Promise<void>((resolve) => { firstStarted = resolve })
    let firstCalls = 0
    let secondCalls = 0

    const firstWork = firstCache.file({
      namespace: 'shared',
      key: VALID_KEY,
      extension: 'txt',
      generate: async () => {
        firstCalls += 1
        firstStarted()
        await firstCanFinish
        return new TextEncoder().encode('first directory')
      },
    })
    await firstDidStart
    const secondWork = secondCache.file({
      namespace: 'shared',
      key: VALID_KEY,
      extension: 'txt',
      generate: async () => {
        secondCalls += 1
        return new TextEncoder().encode('second directory')
      },
    })
    releaseFirst()

    const [first, second] = await Promise.all([firstWork, secondWork])
    expect(firstCalls).toBe(1)
    expect(secondCalls).toBe(1)
    expect(first.hit).toBe(false)
    expect(second.hit).toBe(false)
    expect(first.file.startsWith(firstDirectory)).toBe(true)
    expect(second.file.startsWith(secondDirectory)).toBe(true)
    expect(await fs.readFile(first.file, 'utf8')).toBe('first directory')
    expect(await fs.readFile(second.file, 'utf8')).toBe('second directory')
  })

  it('rejects an invalid namespace, key, and extension', async () => {
    const cacheDirectory = await makeCacheDirectory()
    const cache = createBuildCache(cacheDirectory)
    const generate = async (): Promise<Uint8Array> => new TextEncoder().encode('x')

    await expect(cache.buffer({ namespace: 'bad/ns', key: VALID_KEY, extension: 'png', generate }))
      .rejects.toThrow(/namespace must be a flat identifier/)
    await expect(cache.buffer({ namespace: 'ok', key: 'not-hex', extension: 'png', generate }))
      .rejects.toThrow(/key must be 64 lowercase hex characters/)
    await expect(cache.buffer({ namespace: 'ok', key: VALID_KEY, extension: 'PNG', generate }))
      .rejects.toThrow(/extension must be lowercase alphanumeric/)
  })

  it('throws when generate returns empty output', async () => {
    const cacheDirectory = await makeCacheDirectory()
    const cache = createBuildCache(cacheDirectory)

    await expect(cache.buffer({
      namespace: 'empty',
      key: VALID_KEY,
      extension: 'png',
      generate: async () => new Uint8Array(0),
    })).rejects.toThrow(/empty output/)
  })
})

describe('createBuildCache.file', () => {
  it('returns a path under the cache directory that exists after generation, then hits', async () => {
    const cacheDirectory = await makeCacheDirectory()
    const cache = createBuildCache(cacheDirectory)

    let calls = 0
    const generate = async (): Promise<Uint8Array> => {
      calls += 1
      return new TextEncoder().encode('file-bytes')
    }

    const first = await cache.file({ namespace: 'site-og', key: VALID_KEY, extension: 'png', generate })
    expect(first.hit).toBe(false)
    expect(first.file.startsWith(cacheDirectory)).toBe(true)
    // Sharded layout: <cacheDirectory>/<namespace>/<key[0:2]>/<key>.<extension>
    expect(first.file).toBe(path.join(cacheDirectory, 'site-og', VALID_KEY.slice(0, 2), `${VALID_KEY}.png`))
    await expect(fs.access(first.file)).resolves.toBeUndefined()
    await expect(fs.readFile(first.file, 'utf8')).resolves.toBe('file-bytes')
    // Metadata sidecar is written alongside.
    await expect(fs.readFile(`${first.file}.json`, 'utf8')).resolves.toMatch(/"checksum"/)

    const second = await cache.file({ namespace: 'site-og', key: VALID_KEY, extension: 'png', generate })
    expect(second.hit).toBe(true)
    expect(second.file).toBe(first.file)
    expect(calls).toBe(1)
  })

  it('namespaces are isolated from one another', async () => {
    const cacheDirectory = await makeCacheDirectory()
    const cache = createBuildCache(cacheDirectory)

    const a = await cache.file({
      namespace: 'ns-a',
      key: VALID_KEY,
      extension: 'png',
      generate: async () => new TextEncoder().encode('a'),
    })
    const b = await cache.file({
      namespace: 'ns-b',
      key: VALID_KEY,
      extension: 'png',
      generate: async () => new TextEncoder().encode('b'),
    })
    expect(a.file).not.toBe(b.file)
    expect(await fs.readFile(a.file, 'utf8')).toBe('a')
    expect(await fs.readFile(b.file, 'utf8')).toBe('b')
  })
})

describe('cacheKey', () => {
  it('produces a deterministic 64-hex key for the same input', () => {
    const left = cacheKey({ a: 1, b: 'two' })
    const right = cacheKey({ b: 'two', a: 1 })
    expect(left).toBe(right)
    expect(left).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces different keys for different inputs', () => {
    expect(cacheKey({ a: 1 })).not.toBe(cacheKey({ a: 2 }))
    expect(cacheKey('one')).not.toBe(cacheKey('two'))
  })

  it('matches a raw sha256 of the same string', () => {
    expect(cacheKey('payload')).toBe(crypto.createHash('sha256').update('payload').digest('hex'))
  })
})
