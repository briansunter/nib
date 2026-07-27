import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import type { NibViteTarget } from '@briansunter/nib/plugin'
import { ImageTransformExecutor } from './image-executor'
import {
  createImageTransformRequest,
  imageContentType,
  parseDevelopmentImageRequest,
} from './image-request'
import type { InternalImageSource } from './image-source'
import { ImageSourceCatalog } from './image-source-catalog'
import { isAllowedSource, type NormalizedContentImageSource, type NormalizedImagesOptions } from './options'

const authoredImageContentTypes: Readonly<Record<string, string>> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function normalizedBase(base: string | undefined): string {
  if (!base || base === '/') return '/'
  return `/${base.replace(/^\/+|\/+$/g, '')}/`
}

function authoredContentFile(
  pathname: string,
  source: NormalizedContentImageSource,
  base: string | undefined,
): string | undefined {
  const prefixes = [...new Set([
    source.publicPath,
    `${normalizedBase(base)}${source.publicPath.replace(/^\/+/, '')}`,
  ])].sort((left, right) => right.length - left.length)
  const prefix = prefixes.find((candidate) => pathname.startsWith(candidate))
  if (!prefix) return undefined

  let relative: string
  try {
    relative = decodeURIComponent(pathname.slice(prefix.length))
  } catch {
    return undefined
  }
  if (
    relative === ''
    || relative.includes('\\')
    || path.isAbsolute(relative)
    || relative.split('/').includes('..')
  ) return undefined

  const file = path.resolve(source.directory, relative)
  const fromRoot = path.relative(source.directory, file)
  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return undefined
  return file
}

interface AuthoredContentImage {
  readonly file: string
  readonly contentType: string
  readonly size: number
  readonly modifiedAt: Date
}

async function findAuthoredContentImage(
  pathname: string,
  base: string | undefined,
  options: NormalizedImagesOptions,
): Promise<AuthoredContentImage | undefined> {
  for (const source of options.content) {
    const candidate = authoredContentFile(pathname, source, base)
    if (!candidate) continue
    const contentType = authoredImageContentTypes[path.extname(candidate).toLowerCase()]
    if (!contentType) continue

    const [root, file] = await Promise.all([
      fs.realpath(source.directory).catch(() => undefined),
      fs.realpath(candidate).catch(() => undefined),
    ])
    if (!root || !file || !isAllowedSource(file, [root])) continue
    const stats = await fs.stat(file).catch(() => undefined)
    if (!stats?.isFile()) continue
    return { file, contentType, size: stats.size, modifiedAt: stats.mtime }
  }
  return undefined
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

/** Vite adapter for static image metadata imports and development responses. */
export function imageVitePlugin(
  options: NormalizedImagesOptions,
  target: NibViteTarget = 'development',
): Plugin {
  const sources = new ImageSourceCatalog(options)
  const executor = new ImageTransformExecutor({ concurrency: options.concurrency })
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
      const source = await sources.load(path.isAbsolute(file) ? file : path.resolve(options.root, file))
      this.addWatchFile(source.__nibFile)
      return imageSourceModule(source)
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = request.url
        if (!requestUrl) return next()
        const pathname = new URL(requestUrl, 'http://nib.local').pathname
        if (request.method === 'GET' || request.method === 'HEAD' || request.method === undefined) {
          const authored = await findAuthoredContentImage(pathname, server.config.base, options)
          if (authored) {
            const etag = `"${authored.size.toString(16)}-${Math.trunc(authored.modifiedAt.getTime()).toString(16)}"`
            response.setHeader('ETag', etag)
            response.setHeader('Last-Modified', authored.modifiedAt.toUTCString())
            response.setHeader('Cache-Control', 'no-cache')
            if (request.headers['if-none-match'] === etag) {
              response.statusCode = 304
              response.end()
              return
            }
            response.statusCode = 200
            response.setHeader('Content-Type', authored.contentType)
            response.setHeader('Content-Length', authored.size)
            if (request.method === 'HEAD') {
              response.end()
              return
            }
            const stream = createReadStream(authored.file)
            stream.on('error', (error) => {
              if (response.headersSent) response.destroy(error)
              else next(error)
            })
            stream.pipe(response)
            return
          }
        }
        const parsed = parseDevelopmentImageRequest(pathname)
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
          if (!passthrough && !['avif', 'webp', 'jpeg', 'png'].includes(parsed.format)) {
            response.statusCode = 404
            response.end('Invalid Nib image request')
            return
          }
          const image = createImageTransformRequest(
            source,
            parsed.width,
            parsed.format,
            parsed.quality,
            passthrough,
          )
          const etag = `"${image.key}"`
          response.setHeader('ETag', etag)
          response.setHeader('Cache-Control', 'no-cache')
          if (request.headers['if-none-match'] === etag) {
            response.statusCode = 304
            response.end()
            return
          }
          const result = await executor.cachedBuffer(options.cacheDirectory, image)
          response.statusCode = 200
          response.setHeader('Content-Type', imageContentType(parsed.format))
          response.end(result.data)
        } catch (error) {
          next(error)
        }
      })
    },
    async hotUpdate(context) {
      await sources.refresh(context.file)
    },
  }
}
