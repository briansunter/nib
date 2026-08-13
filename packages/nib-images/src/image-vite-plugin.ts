import { createReadStream, type Dirent } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import type { NibViteTarget } from '@briansunter/nib/plugin'
import { pruneImageCache } from './cache'
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
const contentEntryId = '@briansunter/nib-images/content'
const contentModuleId = '\0@briansunter/nib-images/content'
const supportedContentImageExtensions = new Set(Object.keys(authoredImageContentTypes))

interface ConfiguredContentImage {
  readonly file: string
  readonly publicPath: string
}

interface ResolvedContentImage extends ConfiguredContentImage {
  readonly source: InternalImageSource
}

function validContentPathSegment(segment: string): boolean {
  return segment !== ''
    && segment !== '.'
    && segment !== '..'
    && !/[\\?%#\0]/.test(segment)
}

async function contentFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  const visit = async (current: string): Promise<void> => {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const file = path.join(current, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (
        entry.isFile()
        && supportedContentImageExtensions.has(path.extname(entry.name).toLowerCase())
      ) {
        files.push(file)
      }
    }
  }
  await visit(directory)
  return files
}

async function canonicalSourceRoots(roots: readonly string[]): Promise<string[]> {
  return Promise.all(roots.map(async (root) => {
    try {
      return await fs.realpath(root)
    } catch {
      return root
    }
  }))
}

async function authorizedContentDirectory(
  directory: string,
  allowedRoots: readonly string[],
): Promise<string | undefined> {
  let resolved: string
  try {
    resolved = await fs.realpath(directory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  if (!isAllowedSource(resolved, allowedRoots)) {
    throw new Error(
      `@briansunter/nib-images: content directory resolves outside allowedSourceRoots: ${directory}`,
    )
  }
  return resolved
}

async function configuredContentImages(
  options: NormalizedImagesOptions,
): Promise<ConfiguredContentImage[]> {
  const images = new Map<string, string>()
  const allowedRoots = await canonicalSourceRoots(options.allowedSourceRoots)
  for (const source of options.content) {
    const directory = await authorizedContentDirectory(source.directory, allowedRoots)
    if (directory === undefined) continue
    for (const file of await contentFiles(directory)) {
      const relative = path.relative(directory, file)
      const segments = relative.split(path.sep)
      if (segments.some((segment) => !validContentPathSegment(segment))) {
        throw new Error(
          `@briansunter/nib-images: invalid content image filename for ${file}`,
        )
      }
      const publicPath = `${source.publicPath}${segments.join('/')}`
      const previous = images.get(publicPath)
      if (previous !== undefined) {
        throw new Error(
          `@briansunter/nib-images: duplicate content image public path ${publicPath}: ${previous} and ${file}`,
        )
      }
      images.set(publicPath, file)
    }
  }
  return [...images]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([publicPath, file]) => ({ file, publicPath }))
}

function imageSourceDeclaration(name: string, source: InternalImageSource): string {
  const {
    __nibImage,
    __nibFile,
    __nibSourceId,
    __nibStem,
    ...publicSource
  } = source
  return [
    `const ${name} = ${JSON.stringify(publicSource)}`,
    `Object.defineProperties(${name}, ${JSON.stringify({
      __nibImage: { value: __nibImage },
      __nibFile: { value: __nibFile },
      __nibSourceId: { value: __nibSourceId },
      __nibStem: { value: __nibStem },
    })})`,
  ].join('\n')
}

function contentImageModule(images: readonly ResolvedContentImage[]): string {
  const declarations = images.map((image, index) => (
    imageSourceDeclaration(`source${index}`, image.source)
  ))
  const entries = images.map((image, index) => (
    `  [${JSON.stringify(image.publicPath)}, source${index}],`
  ))
  return [
    ...declarations,
    `const byPublicPath = new Map([\n${entries.join('\n')}\n])`,
    'function normalizedPublicPath(value) {',
    "  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return undefined",
    '  if (/%(?:2f|5c)/i.test(value)) return undefined',
    '  let decoded',
    '  try { decoded = decodeURIComponent(value) } catch { return undefined }',
    "  if (decoded.includes('\\\\') || decoded.includes('?') || decoded.includes('#') || decoded.includes('%') || decoded.includes('\\0') || decoded.includes('//')) return undefined",
    "  if (decoded.split('/').some((segment) => segment === '.' || segment === '..')) return undefined",
    '  return decoded',
    '}',
    'export function resolveContentImage(publicPath) {',
    '  const normalized = normalizedPublicPath(publicPath)',
    '  return normalized === undefined ? undefined : byPublicPath.get(normalized)',
    '}',
  ].join('\n')
}

function normalizedBase(base: string | undefined): string {
  if (!base || base === '/') return '/'
  return `/${base.replace(/^\/+|\/+$/g, '')}/`
}

function configuredContentPath(
  file: string,
  options: NormalizedImagesOptions,
): boolean {
  const resolved = path.resolve(file)
  return options.content.some((source) => {
    const relative = path.relative(source.directory, resolved)
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
  })
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

  const encoded = pathname.slice(prefix.length)
  if (/%(?:2f|5c)/i.test(encoded)) return undefined
  let relative: string
  try {
    relative = decodeURIComponent(encoded)
  } catch {
    return undefined
  }
  const segments = relative.split('/')
  if (
    relative === ''
    || relative.includes('\\')
    || relative.includes('%')
    || relative.includes('\0')
    || path.isAbsolute(relative)
    || segments.some((segment) => segment === '' || segment === '.' || segment === '..')
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
  const allowedRoots = await canonicalSourceRoots(options.allowedSourceRoots)
  for (const source of options.content) {
    const candidate = authoredContentFile(pathname, source, base)
    if (!candidate) continue
    const contentType = authoredImageContentTypes[path.extname(candidate).toLowerCase()]
    if (!contentType) continue

    const root = await fs.realpath(source.directory).catch(() => undefined)
    if (!root || !isAllowedSource(root, allowedRoots)) continue
    const file = await fs.realpath(candidate).catch(() => undefined)
    if (!file || !isAllowedSource(file, [root])) continue
    const stats = await fs.stat(file).catch(() => undefined)
    if (!stats?.isFile()) continue
    return { file, contentType, size: stats.size, modifiedAt: stats.mtime }
  }
  return undefined
}

function staticOnlyError(): Error {
  return new Error(
    '@briansunter/nib-images: package entry points and ?nib-image imports are static-only and cannot be included in browser-target modules',
  )
}

function isPublicEntry(id: string): boolean {
  return id === '@briansunter/nib-images'
    || id === '@briansunter/nib-images/plugin'
    || id === contentEntryId
}

function imageSourceModule(source: InternalImageSource): string {
  return [
    imageSourceDeclaration('source', source),
    'export default source',
  ].join('\n')
}

/** Vite adapter for static image metadata imports and development responses. */
export function imageVitePlugin(
  options: NormalizedImagesOptions,
  target: NibViteTarget = 'development',
): Plugin {
  const sources = new ImageSourceCatalog(options)
  const executor = new ImageTransformExecutor({
    concurrency: options.concurrency,
    cacheVerification: options.cache.verification,
  })
  const activeCacheKeys = new Set<string>()
  return {
    name: '@briansunter/nib-images',
    enforce: 'pre',
    resolveId(id) {
      if (
        isPublicEntry(id)
        && (
          target === 'client'
          || (target === 'development' && this.environment.name === 'client')
        )
      ) {
        throw staticOnlyError()
      }
      if (id === contentEntryId) return contentModuleId
      return null
    },
    async load(id) {
      if (id === contentModuleId) {
        const configured = await configuredContentImages(options)
        for (const source of options.content) this.addWatchFile(source.directory)
        const images: ResolvedContentImage[] = []
        for (const image of configured) {
          this.addWatchFile(image.file)
          try {
            images.push({ ...image, source: await sources.load(image.file) })
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error)
            this.warn(`nib-images: omitting ${image.publicPath} after source inspection failure: ${detail}`)
          }
        }
        return contentImageModule(images)
      }
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
        if (request.method !== 'GET' && request.method !== 'HEAD') return next()
        const pathname = new URL(requestUrl, 'http://nib.local').pathname
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
          activeCacheKeys.add(image.key)
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
          response.setHeader('Content-Length', result.data.length)
          response.end(request.method === 'HEAD' ? undefined : result.data)
        } catch (error) {
          next(error)
        }
      })
    },
    async hotUpdate(context) {
      const contentChange = configuredContentPath(context.file, options)
      if (context.type === 'update') {
        try {
          await sources.refresh(context.file)
        } catch (error) {
          if (!contentChange) throw error
        }
      }
      if (!contentChange) return
      const contentModule = this.environment.moduleGraph.getModuleById(contentModuleId)
      if (contentModule === undefined) return
      this.environment.moduleGraph.invalidateModule(
        contentModule,
        new Set(),
        context.timestamp,
        true,
      )
      return [...new Set([...context.modules, contentModule])]
    },
    async closeBundle() {
      if (target === 'development') {
        await pruneImageCache(options.cacheDirectory, options.cache, activeCacheKeys)
      }
    },
  }
}
