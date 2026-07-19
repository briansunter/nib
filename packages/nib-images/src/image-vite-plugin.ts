import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Plugin } from 'vite'
import type { NibViteTarget } from '@briansunter/nib/plugin'
import { cachedBuffer } from './cache'
import type { ImageFormat, InternalImageSource, SourceImageFormat } from './image-source'
import { isAllowedSource, type NormalizedImagesOptions } from './options'
import { requestKey } from './image-registry'
import { transformImage } from './processor'
import { createTaskQueue } from './concurrency'

const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'])

function digest(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function imageFormat(format: string | undefined, file: string): SourceImageFormat {
  const fromFormat = format === 'jpg' ? 'jpeg' : format
  if (fromFormat && ['jpeg', 'png', 'webp', 'avif', 'gif', 'svg'].includes(fromFormat)) {
    return fromFormat as SourceImageFormat
  }
  throw new Error(`@briansunter/nib-images: unsupported image format: ${file}`)
}

function sourceId(file: string): string {
  return digest(path.resolve(file)).slice(0, 24)
}

function safeStem(file: string): string {
  return path.basename(file, path.extname(file))
}

async function inspectImage(file: string): Promise<InternalImageSource> {
  const fingerprint = new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    createReadStream(file)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
  })
  const [metadata, contentFingerprint] = await Promise.all([
    sharp(file, { animated: true, limitInputPixels: 100_000_000 }).metadata(),
    fingerprint,
  ])
  if (!metadata.width || !metadata.height) {
    throw new Error(`@briansunter/nib-images: could not read dimensions for ${file}`)
  }
  const rotated = metadata.orientation !== undefined && [5, 6, 7, 8].includes(metadata.orientation)
  return {
    __nibImage: true,
    __nibFile: file,
    __nibSourceId: sourceId(file),
    __nibStem: safeStem(file),
    width: rotated ? metadata.height : metadata.width,
    height: rotated ? metadata.width : metadata.height,
    format: imageFormat(metadata.format, file),
    hasAlpha: metadata.hasAlpha ?? false,
    animated: (metadata.pages ?? 1) > 1,
    fingerprint: contentFingerprint,
  } as InternalImageSource
}

async function inspectHotImage(file: string): Promise<InternalImageSource> {
  let failure: unknown
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await inspectImage(file)
    } catch (error) {
      failure = error
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)))
    }
  }
  throw failure
}

function parseDevRequest(pathname: string): {
  sourceId: string
  width: number
  quality: number
  format: ImageFormat | 'gif' | 'svg'
} | undefined {
  const marker = pathname.indexOf('/@nib-images/')
  if (marker === -1) return undefined
  const match = pathname.slice(marker).match(/^\/@nib-images\/([a-f0-9]{24})\/(\d+)-(\d+)\.(avif|webp|jpeg|png|gif|svg)$/)
  if (!match) return undefined
  return {
    sourceId: match[1]!,
    width: Number(match[2]),
    quality: Number(match[3]),
    format: match[4]! as ImageFormat | 'gif' | 'svg',
  }
}

function contentType(format: ImageFormat | 'gif' | 'svg'): string {
  return format === 'svg' ? 'image/svg+xml' : `image/${format}`
}

function staticOnlyError(): Error {
  return new Error(
    '@briansunter/nib-images: Image and ?nib-image imports are static-only and cannot be included in a React island',
  )
}

function imageSourceModule(source: InternalImageSource): string {
  const {
    __nibImage,
    __nibFile,
    __nibSourceId,
    __nibStem,
    ...publicSource
  } = source
  return [
    `const source = ${JSON.stringify(publicSource)}`,
    `Object.defineProperties(source, ${JSON.stringify({
      __nibImage: { value: __nibImage },
      __nibFile: { value: __nibFile },
      __nibSourceId: { value: __nibSourceId },
      __nibStem: { value: __nibStem },
    })})`,
    'export default source',
  ].join('\n')
}

export function imageVitePlugin(
  options: NormalizedImagesOptions,
  target: NibViteTarget = 'development',
): Plugin {
  const sources = new Map<string, InternalImageSource>()
  const transform = createTaskQueue(options.concurrency)
  const hotInspections = new Map<string, Promise<void>>()
  const allowedRoots = Promise.all(options.allowedSourceRoots.map(async (root) => {
    try {
      return await fs.realpath(root)
    } catch {
      return root
    }
  }))
  const refreshSource = async (file: string): Promise<void> => {
    const unresolved = path.resolve(file)
    const changed = await fs.realpath(unresolved).catch(() => unresolved)
    const existing = hotInspections.get(changed)
    if (existing) return existing
    const matching = [...sources].filter(([, source]) => source.__nibFile === changed)
    if (matching.length === 0) return
    const refresh = (async () => {
      const updated = await inspectHotImage(changed)
      sources.set(updated.__nibSourceId, updated)
      for (const [id] of matching) {
        if (id !== updated.__nibSourceId) sources.delete(id)
      }
    })()
    hotInspections.set(changed, refresh)
    try {
      await refresh
    } finally {
      hotInspections.delete(changed)
    }
  }
  return {
    name: '@briansunter/nib-images',
    enforce: 'pre',
    resolveId(id) {
      if (
        id === '@briansunter/nib-images'
        && (
          target === 'client'
          || (target === 'development' && this.environment.name === 'client')
        )
      ) {
        throw staticOnlyError()
      }
      return null
    },
    async load(id) {
      const queryIndex = id.indexOf('?')
      const file = queryIndex === -1 ? id : id.slice(0, queryIndex)
      const query = queryIndex === -1 ? undefined : id.slice(queryIndex + 1)
      if (!query || !new URLSearchParams(query).has('nib-image')) return null
      if (
        target === 'client'
        || (target === 'development' && this.environment.name === 'client')
      ) {
        throw staticOnlyError()
      }
      const resolved = await fs.realpath(path.resolve(file))
      if (!supportedExtensions.has(path.extname(resolved).toLowerCase())) {
        throw new Error(`@briansunter/nib-images: unsupported image file ${resolved}`)
      }
      if (!isAllowedSource(resolved, await allowedRoots)) {
        throw new Error(`@briansunter/nib-images: source is outside allowedSourceRoots: ${resolved}`)
      }
      this.addWatchFile(resolved)
      const source = await inspectImage(resolved)
      sources.set(source.__nibSourceId, source)
      return imageSourceModule(source)
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = request.url
        if (!requestUrl) return next()
        const parsed = parseDevRequest(new URL(requestUrl, 'http://nib.local').pathname)
        if (!parsed) return next()
        try {
          const source = sources.get(parsed.sourceId)
          if (!source || parsed.width <= 0 || parsed.width > source.width || parsed.quality < 1 || parsed.quality > 100) {
            response.statusCode = 404
            response.end('Unknown Nib image request')
            return
          }
          const passthrough = parsed.width === source.width
            && parsed.quality === 100
            && parsed.format === source.format
          const transformable = ['avif', 'webp', 'jpeg', 'png'].includes(parsed.format)
          if (!passthrough && !transformable) {
            response.statusCode = 404
            response.end('Invalid Nib image request')
            return
          }
          const key = requestKey(source, parsed.width, parsed.format, parsed.quality, passthrough)
          const etag = `"${key}"`
          response.setHeader('ETag', etag)
          response.setHeader('Cache-Control', 'no-cache')
          if (request.headers['if-none-match'] === etag) {
            response.statusCode = 304
            response.end()
            return
          }
          const result = await cachedBuffer(
            options.cacheDirectory,
            key,
            parsed.format,
            () => transform(() => (
              transformImage(source, parsed.width, parsed.format, parsed.quality, passthrough)
            )),
          )
          response.statusCode = 200
          response.setHeader('Content-Type', contentType(parsed.format))
          response.end(result.data)
        } catch (error) {
          next(error)
        }
      })
    },
    async hotUpdate(options) {
      await refreshSource(options.file)
    },
  }
}
