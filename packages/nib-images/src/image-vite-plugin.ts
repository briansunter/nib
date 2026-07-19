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
import type { NormalizedImagesOptions } from './options'

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
        const parsed = parseDevelopmentImageRequest(new URL(requestUrl, 'http://nib.local').pathname)
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
