import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Plugin } from 'vite'
import { cachedBuffer } from './cache'
import type { ImageFormat, InternalImageSource, SourceImageFormat } from './image-source'
import { isAllowedSource, type NormalizedImagesOptions } from './options'
import { requestKey } from './image-registry'
import { transformImage } from './processor'

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
  const metadata = await sharp(file, { animated: true, limitInputPixels: 100_000_000 }).metadata()
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
    fingerprint: digest(await fs.readFile(file)),
  } as InternalImageSource
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
  return `image/${format}`
}

export function imageVitePlugin(
  options: NormalizedImagesOptions,
): Plugin {
  const sources = new Map<string, InternalImageSource>()
  return {
    name: '@briansunter/nib-images',
    enforce: 'pre',
    async load(id) {
      const [file, query] = id.split('?', 2)
      if (!query || !new URLSearchParams(query).has('nib-image')) return null
      const resolved = path.resolve(file!)
      if (!supportedExtensions.has(path.extname(resolved).toLowerCase())) {
        throw new Error(`@briansunter/nib-images: unsupported image file ${resolved}`)
      }
      if (!isAllowedSource(resolved, options.allowedSourceRoots)) {
        throw new Error(`@briansunter/nib-images: source is outside allowedSourceRoots: ${resolved}`)
      }
      const source = await inspectImage(resolved)
      sources.set(source.__nibSourceId, source)
      return `export default ${JSON.stringify(source)}`
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
          const result = await cachedBuffer(
            options.cacheDirectory,
            key,
            parsed.format,
            () => transformImage(source, parsed.width, parsed.format, parsed.quality, passthrough),
          )
          response.statusCode = 200
          response.setHeader('Content-Type', contentType(parsed.format))
          response.setHeader('Cache-Control', 'no-store')
          response.end(result.data)
        } catch (error) {
          next(error)
        }
      })
    },
    handleHotUpdate(context) {
      const changed = path.resolve(context.file)
      for (const [id, source] of sources) {
        if (source.__nibFile === changed) sources.delete(id)
      }
    },
  }
}
