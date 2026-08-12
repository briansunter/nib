import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Image, useImage } from '../src/image-component'
import type { ImageResult } from '../src/image-builder'
import { ImageRegistryProvider } from '../src/image-context'
import { ImageBuildRegistry } from '../src/image-registry'
import { createImageSource } from '../src/image-source'
import { intrinsicDimensions } from '../src/image-source-catalog'
import { imageVitePlugin } from '../src/image-vite-plugin'
import { normalizeImagesOptions } from '../src/options'
import { cachedBuffer, pruneImageCache } from '../src/cache'
import { images } from '../src/plugin'
import {
  createImageTransformRequest,
  developmentImageUrl,
  parseDevelopmentImageRequest,
} from '../src/image-request'
import {
  optimizeContentImages,
  restoreFailedContentImages,
} from '../src/content-images'

const temporaryDirectories: string[] = []
const pageArtifact = (artifact: string) => [{
  kind: 'page',
  artifact,
  contentType: 'text/html; charset=utf-8',
}] as const

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, {
    recursive: true,
    force: true,
  })))
})

async function fixtureSource() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
  temporaryDirectories.push(root)
  const file = path.join(root, 'hero.png')
  await sharp({ create: { width: 80, height: 40, channels: 4, background: '#ff00ff80' } }).png().toFile(file)
  return createImageSource({
    __nibImage: true,
    __nibFile: file,
    __nibSourceId: '0123456789abcdef01234567',
    __nibStem: 'hero',
    width: 80,
    height: 40,
    format: 'png',
    hasAlpha: true,
    animated: false,
    fingerprint: 'fixture-fingerprint',
  })
}

describe('static Image component', () => {
  it('uses one animated frame for intrinsic dimensions', () => {
    expect(intrinsicDimensions({
      width: 1028,
      height: 149376,
      pageHeight: 778,
      orientation: undefined,
    })).toEqual({ width: 1028, height: 778 })
    expect(intrinsicDimensions({
      width: 20,
      height: 10,
      pageHeight: undefined,
      orientation: 6,
    })).toEqual({ width: 10, height: 20 })
  })

  it('normalizes concurrency against an explicit memory budget', () => {
    const root = path.resolve('.')
    expect(normalizeImagesOptions(root, { concurrency: 4, memoryLimitMb: 383 }).concurrency)
      .toBe(1)
    expect(normalizeImagesOptions(root, { concurrency: 4, memoryLimitMb: 384 }).concurrency)
      .toBe(2)
    expect(normalizeImagesOptions(root, { concurrency: 4, memoryLimitMb: 768 }).concurrency)
      .toBe(4)
    expect(() => normalizeImagesOptions(root, null as any)).toThrow('options must be an object')
    expect(() => normalizeImagesOptions(root, { quality: { png: 50 } } as any))
      .toThrow('quality does not support png')
    expect(normalizeImagesOptions(root, {
      content: [{ publicPath: '/site-assets/', directory: 'src/assets/site-assets', maxWidth: 1720 }],
    }).content[0]?.maxWidth).toBe(1720)
    expect(normalizeImagesOptions(root).cache).toEqual({
      maxBytes: 1024 * 1024 * 1024,
      maxEntries: 10_000,
      verification: 'metadata',
    })
    expect(normalizeImagesOptions(root, {
      cache: { maxBytes: 1_000, maxEntries: 5, verification: 'checksum' },
    }).cache).toEqual({
      maxBytes: 1_000,
      maxEntries: 5,
      verification: 'checksum',
    })
    expect(() => normalizeImagesOptions(root, {
      content: [{ publicPath: '/site-assets/', directory: 'src/assets/site-assets', maxWidth: 0 }],
    } as any)).toThrow('content[0].maxWidth must contain positive integers')
    expect(() => normalizeImagesOptions(root, {
      content: [{ publicPath: '/../site-assets/', directory: 'src/assets/site-assets' }],
    })).toThrow('publicPath must start and end')
    expect(() => images({ widths: [] } as any)).toThrow('widths must contain positive integers')
    expect(() => images({ cache: { maxBytes: 0 } } as any)).toThrow('cache.maxBytes')
    expect(() => images({ cache: { maxEntries: 1.5 } } as any)).toThrow('cache.maxEntries')
    expect(() => images({ cache: { verification: 'mtime' } } as any))
      .toThrow('cache.verification')
  })

  it('rejects image metadata imports from browser-target graphs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const options = normalizeImagesOptions(root)
    const plugin = imageVitePlugin(options, 'client')
    const resolveId = plugin.resolveId
    if (typeof resolveId !== 'function') throw new Error('Image Vite plugin has no resolve hook')
    expect(() => resolveId.call(
      { environment: { name: 'client' } } as any,
      '@briansunter/nib-images',
      '/src/enhancements/gallery/index.client.ts',
      { isEntry: false },
    )).toThrow('cannot be included in browser-target modules')
    const load = plugin.load as (...args: any[]) => unknown
    await expect(load.call(
      { environment: { name: 'client' } },
      path.join(root, 'hero.png?nib-image'),
    )).rejects.toThrow('cannot be included in browser-target modules')
  })

  it('rejects symlinks that escape allowed source roots', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-allowed-'))
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-outside-'))
    temporaryDirectories.push(root, outside)
    const outsideFile = path.join(outside, 'outside.png')
    await sharp({
      create: { width: 10, height: 10, channels: 3, background: '#336699' },
    }).png().toFile(outsideFile)
    const link = path.join(root, 'linked.png')
    await fs.symlink(outsideFile, link)
    const plugin = imageVitePlugin(normalizeImagesOptions(root), 'server')
    const load = plugin.load as (...args: any[]) => unknown
    await expect(load.call(
      { environment: { name: 'ssr' } },
      `${link}?nib-image`,
    )).rejects.toThrow('outside allowedSourceRoots')
  })

  it('emits oriented dimensions and content fingerprints from metadata imports', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-oriented-'))
    temporaryDirectories.push(root)
    const file = path.join(root, 'oriented.jpg')
    await sharp({
      create: { width: 20, height: 10, channels: 3, background: '#336699' },
    }).jpeg().withMetadata({ orientation: 6 }).toFile(file)
    const plugin = imageVitePlugin(normalizeImagesOptions(root), 'server')
    if (typeof plugin.load !== 'function') throw new Error('Image Vite plugin has no load hook')
    const result = await plugin.load.call(
      { environment: { name: 'ssr' }, addWatchFile() {} } as any,
      `${file}?nib-image`,
    )
    if (typeof result !== 'string') throw new Error('Image metadata load returned no module')
    const loaded = await import(`data:text/javascript;base64,${Buffer.from(result).toString('base64')}`)
    const metadata = loaded.default
    expect(metadata).toMatchObject({
      width: 10,
      height: 20,
      format: 'jpeg',
      animated: false,
    })
    expect(metadata.fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(metadata)).not.toContain('__nibFile')
    expect(metadata.__nibFile).toBe(await fs.realpath(file))
  })

  it('resolves project-relative metadata imports from the configured site root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-relative-'))
    temporaryDirectories.push(root)
    const assetDirectory = path.join(root, 'src', 'assets')
    await fs.mkdir(assetDirectory, { recursive: true })
    await sharp({
      create: { width: 20, height: 10, channels: 3, background: '#336699' },
    }).png().toFile(path.join(assetDirectory, 'hero.png'))
    const plugin = imageVitePlugin(normalizeImagesOptions(root), 'server')
    if (typeof plugin.load !== 'function') throw new Error('Image Vite plugin has no load hook')
    const result = await plugin.load.call(
      { environment: { name: 'ssr' }, addWatchFile() {} } as any,
      'src/assets/hero.png?nib-image',
    )
    expect(result).toContain('"width":20')
  })

  it('renders responsive static picture markup with lazy defaults', async () => {
    const root = temporaryDirectories[0] ?? await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    if (!temporaryDirectories.includes(root)) temporaryDirectories.push(root)
    const registry = new ImageBuildRegistry(
      normalizeImagesOptions(root, { widths: [40, 80] }), '/', 'production',
    )
    const source = await fixtureSource()
    const html = renderToStaticMarkup(createElement(
      ImageRegistryProvider,
      { registry, children: createElement(Image, { src: source, alt: 'A translucent fixture', layout: 'full' }) },
    ))
    expect(html).toContain('<picture>')
    expect(html).toContain('type="image/avif"')
    expect(html).toContain('type="image/webp"')
    expect(html).toContain('.png')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('decoding="async"')
    expect(html).toContain('data-nib-orientation="landscape"')
    expect(html).toContain('--nib-image-source-width:80px')
    expect(html).toContain('--nib-image-source-height:40px')
    expect(html).toContain('--nib-image-source-aspect:2')
    expect(html).not.toContain('--nib-image-comfort-width')
    expect(html).toContain('sizes="100vw"')
    expect(html).not.toContain('data-nib-enhancements')
  })

  it('useImage resolves optimized sources for manual rendering and serialization', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-useimage-'))
    temporaryDirectories.push(root)
    const registry = new ImageBuildRegistry(
      normalizeImagesOptions(root, { widths: [40, 80], formats: ['avif', 'webp'] }),
      '/',
      'production',
    )
    const source = await fixtureSource()
    const results: ImageResult[] = []
    function Probe() {
      const getImage = useImage()
      results.push(getImage({ src: source, layout: 'full' }))
      return null
    }
    renderToStaticMarkup(createElement(
      ImageRegistryProvider,
      { registry, children: createElement(Probe) },
    ))
    expect(results).toHaveLength(1)
    const result = results[0]!
    expect(result.src).toMatch(/^\/assets\/nib\/.+\.png$/)
    expect(result.srcSet).toContain(' 40w')
    expect(result.srcSet).toContain(' 80w')
    expect(result.sizes).toBe('100vw')
    expect(result.width).toBe(80)
    expect(result.height).toBe(40)
    expect(result.sources.map((entry) => entry.type)).toEqual(['image/avif', 'image/webp'])
    expect(result.sources[0]!.srcSet).toContain(' 80w')
    // The same transforms <Image> would register, available without a render.
    expect(registry.requests().some((request) => request.format === 'avif' && request.width === 80))
      .toBe(true)
  })

  it('uses correct fixed-density descriptors and display dimensions', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const registry = new ImageBuildRegistry(
      normalizeImagesOptions(root, { widths: [40, 80] }), '/', 'production',
    )
    const source = await fixtureSource()
    const html = renderToStaticMarkup(createElement(
      ImageRegistryProvider,
      {
        registry,
        children: createElement(Image, {
          src: source,
          alt: 'Fixed fixture',
          layout: 'fixed',
          width: 30,
          densities: [1, 3],
        }),
      },
    ))
    expect(html).toContain('width="30"')
    expect(html).toContain('height="15"')
    expect(html).toContain(' 1x')
    expect(html).toContain(' 2.667x')
    expect(html).not.toContain(' 1.5w')
  })

  it('keeps exact constrained 1x and 2x candidates while pruning near duplicates', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const registry = new ImageBuildRegistry(
      normalizeImagesOptions(root, { widths: [20, 29, 32, 60, 80] }), '/', 'production',
    )
    const source = await fixtureSource()
    const html = renderToStaticMarkup(createElement(
      ImageRegistryProvider,
      {
        registry,
        children: createElement(Image, {
          src: source,
          alt: 'Constrained fixture',
          width: 30,
        }),
      },
    ))
    expect(html).toContain('width="30"')
    expect(html).toContain('-30.')
    expect(html).toContain(' 30w')
    expect(html).toContain('-60.')
    expect(html).toContain(' 60w')
    expect(html).not.toContain(' 29w')
    expect(html).not.toContain(' 32w')
  })

  it('keeps an explicitly authored width ladder independent from intrinsic dimensions', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const registry = new ImageBuildRegistry(
      normalizeImagesOptions(root, { widths: [20, 40, 80] }), '/', 'production',
    )
    const source = await fixtureSource()
    const html = renderToStaticMarkup(createElement(
      ImageRegistryProvider,
      {
        registry,
        children: createElement(Image, {
          src: source,
          alt: 'Authored ladder fixture',
          layout: 'constrained',
          width: 60,
          widths: [20, 40],
        }),
      },
    ))
    expect(html).toContain('width="60"')
    expect(html).toContain(' 20w')
    expect(html).toContain(' 40w')
    expect(html).not.toContain(' 60w')
    expect(registry.requests().every((request) => request.width <= 40)).toBe(true)
  })

  it('uses maxWidth as a hard responsive-transform cap', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const registry = new ImageBuildRegistry(
      normalizeImagesOptions(root, { widths: [20, 40, 80] }), '/', 'production',
    )
    const source = await fixtureSource()
    const html = renderToStaticMarkup(createElement(
      ImageRegistryProvider,
      {
        registry,
        children: createElement(Image, {
          src: source,
          alt: 'Capped fixture',
          layout: 'full',
          maxWidth: 40,
          widths: [20, 40, 80],
        }),
      },
    ))
    expect(html).toContain('width="40"')
    expect(html).toContain(' 40w')
    expect(html).not.toContain(' 80w')
    expect(registry.requests().every((request) => request.width <= 40)).toBe(true)
    expect(() => renderToStaticMarkup(createElement(
      ImageRegistryProvider,
      {
        registry,
        children: createElement(Image, {
          src: source,
          alt: 'Invalid cap',
          layout: 'constrained',
          width: 60,
          maxWidth: 40,
        }),
      },
    ))).toThrow('maxWidth cannot be smaller')
  })

  it('validates numeric props at runtime and keeps pass-through layout dimensions', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const registry = new ImageBuildRegistry(
      normalizeImagesOptions(root, { widths: [40, 80] }), '/', 'production',
    )
    const source = await fixtureSource()
    const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(
      ImageRegistryProvider,
      {
        registry,
        children: createElement(Image, { src: source, alt: 'Fixture', ...props } as any),
      },
    ))
    expect(() => render({ layout: 'fixed', width: 0 })).toThrow('width must be a positive integer')
    expect(() => render({ layout: 'fixed', width: 20, densities: [1, 4] }))
      .toThrow('densities may contain only')
    expect(() => render({ quality: { png: 50 } }))
      .toThrow('quality does not support png')
    expect(() => render({ priority: true, loading: 'lazy' }))
      .toThrow('priority cannot be combined')
    expect(() => render({ layout: 'unknown' })).toThrow('unsupported layout')
    const unoptimized = render({ layout: 'fixed', width: 20, unoptimized: true })
    expect(unoptimized).toContain('width="20"')
    expect(unoptimized).toContain('height="10"')
    expect(unoptimized).not.toContain('srcSet')
  })

  it('writes content-addressed transforms, then uses them on a warm run', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const source = await fixtureSource()
    const options = normalizeImagesOptions(root, { widths: [40, 80], formats: ['webp'], concurrency: 2 })
    const first = new ImageBuildRegistry(options, '/base/', 'production')
    expect(first.register(source as any, 40, 'webp', 75))
      .toMatch(/^\/base\/assets\/nib\//)
    await first.finalize(path.join(root, 'dist/client'))
    expect(first.stats()).toMatchObject({ coldTransforms: 1, cacheHits: 0 })
    const output = await fs.readdir(path.join(root, 'dist/client/assets/nib'))
    expect(output).toHaveLength(1)
    const provenance = JSON.parse(await fs.readFile(
      path.join(root, 'dist/client/.nib/images.json'),
      'utf8',
    )) as {
      version: number
      candidates: Array<Record<string, unknown>>
    }
    expect(provenance).toMatchObject({
      version: 1,
      candidates: [{
        output: `assets/nib/${output[0]}`,
        width: 40,
        height: 20,
        format: 'webp',
        sourceWidth: 80,
        sourceHeight: 40,
        maxWidth: 40,
      }],
    })
    expect(JSON.stringify(provenance)).not.toContain(root)
    expect(JSON.stringify(provenance)).not.toContain('__nibFile')

    const second = new ImageBuildRegistry(options, '/base/', 'production')
    second.register(source as any, 40, 'webp', 75)
    await second.finalize(path.join(root, 'dist/again'))
    expect(second.stats()).toMatchObject({ coldTransforms: 0, cacheHits: 1 })
  })

  it('prefixes development transform URLs with the configured base', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const source = await fixtureSource()
    const registry = new ImageBuildRegistry(
      normalizeImagesOptions(root, { widths: [40] }),
      '/repository/',
      'development',
    )
    expect(registry.register(source as any, 40, 'webp', 75))
      .toMatch(/^\/repository\/@nib-images\//)
  })

  it('uses one validated protocol for build and development image requests', async () => {
    const source = await fixtureSource()
    const request = createImageTransformRequest(source as any, 40, 'webp', 75)
    const url = developmentImageUrl('/repository/', request)
    expect(parseDevelopmentImageRequest(url)).toEqual({
      sourceId: request.source.__nibSourceId,
      width: 40,
      quality: 75,
      format: 'webp',
    })
    expect(() => createImageTransformRequest(source as any, 40, 'gif', 75))
      .toThrow('cannot transform to gif')
  })

  it('serves authored content images in development without exposing source escapes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-dev-content-'))
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-dev-outside-'))
    temporaryDirectories.push(root, outside)
    const publicDirectory = path.join(root, 'src', 'assets', 'site-assets')
    await fs.mkdir(publicDirectory, { recursive: true })
    const sourceFile = path.join(publicDirectory, 'hero.png')
    const sourceData = await sharp({
      create: { width: 16, height: 8, channels: 3, background: '#336699' },
    }).png().toBuffer()
    await fs.writeFile(sourceFile, sourceData)
    await fs.writeFile(path.join(outside, 'secret.png'), sourceData)
    await fs.symlink(path.join(outside, 'secret.png'), path.join(publicDirectory, 'link.png'))

    const plugin = imageVitePlugin(normalizeImagesOptions(root, {
      content: [{ publicPath: '/site-assets/', directory: 'src/assets/site-assets' }],
    }), 'development')
    let middleware: ((request: any, response: any, next: () => void) => Promise<void>) | undefined
    const configureServer = (plugin as any).configureServer
    configureServer({
      config: { base: '/repository/' },
      middlewares: { use(handler: typeof middleware) { middleware = handler } },
    } as any)
    if (!middleware) throw new Error('Image Vite plugin did not install its middleware')

    const request = (
      url: string,
      headers: Record<string, string> = {},
      method: 'GET' | 'HEAD' = 'GET',
    ) => {
      const response = new PassThrough() as PassThrough & {
        statusCode: number
        headersSent: boolean
        headers: Map<string, string | number>
        setHeader(name: string, value: string | number): void
      }
      response.statusCode = 200
      response.headersSent = false
      response.headers = new Map()
      response.setHeader = (name, value) => response.headers.set(name.toLowerCase(), value)
      const body = new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => resolve(Buffer.concat(chunks)))
        response.on('error', reject)
      })
      const next = vi.fn()
      return { response, body, next, promise: middleware!({ url, method, headers }, response, next) }
    }

    const served = request('/repository/site-assets/hero.png')
    await served.promise
    expect(await served.body).toEqual(sourceData)
    expect(served.response.statusCode).toBe(200)
    expect(served.response.headers.get('content-type')).toBe('image/png')
    expect(served.next).not.toHaveBeenCalled()

    const head = request('/repository/site-assets/hero.png', {}, 'HEAD')
    await head.promise
    expect(await head.body).toHaveLength(0)
    expect(head.response.statusCode).toBe(200)
    expect(head.response.headers.get('content-length')).toBe(sourceData.length)

    const cached = request('/repository/site-assets/hero.png', {
      'if-none-match': String(served.response.headers.get('etag')),
    })
    await cached.promise
    expect(await cached.body).toHaveLength(0)
    expect(cached.response.statusCode).toBe(304)

    const escaped = request('/repository/site-assets/%2e%2e/secret.png')
    await escaped.promise
    expect(escaped.next).toHaveBeenCalledOnce()

    const symlink = request('/repository/site-assets/link.png')
    await symlink.promise
    expect(symlink.next).toHaveBeenCalledOnce()
  })

  it('deduplicates requests and never exceeds transform concurrency', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const source = await fixtureSource()
    const options = normalizeImagesOptions(root, {
      widths: [20, 40, 60, 80],
      formats: ['webp'],
      concurrency: 2,
    })
    const registry = new ImageBuildRegistry(options, '/', 'production')
    for (const width of options.widths) {
      registry.register(source as any, width, 'webp', 75)
      registry.register(source as any, width, 'webp', 75)
    }
    expect(registry.requests()).toHaveLength(4)
    await registry.finalize(path.join(root, 'dist/client'))
    expect(registry.stats()).toMatchObject({
      coldTransforms: 4,
      cacheHits: 0,
      peakTransforms: 2,
    })
    await expect(registry.finalize(path.join(root, 'dist/again')))
      .rejects.toThrow('only finalize once')
  })

  it('reuses one materialized URL for content-identical source aliases', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-alias-'))
    temporaryDirectories.push(root)
    const source = await fixtureSource()
    const alias = createImageSource({
      __nibImage: true,
      __nibFile: path.join(root, 'renamed.png'),
      __nibSourceId: 'fedcba9876543210fedcba98',
      __nibStem: 'renamed',
      width: source.width,
      height: source.height,
      format: source.format,
      hasAlpha: source.hasAlpha,
      animated: source.animated,
      fingerprint: source.fingerprint,
    })
    const registry = new ImageBuildRegistry(
      normalizeImagesOptions(root, { widths: [40], formats: ['webp'] }),
      '/',
      'production',
    )

    const first = registry.register(source as any, 40, 'webp', 75)
    const second = registry.register(alias as any, 40, 'webp', 75)

    expect(second).toBe(first)
    expect(registry.requests()).toHaveLength(1)
  })

  it('detects and replaces a non-empty corrupt cache artifact', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const source = await fixtureSource()
    const options = normalizeImagesOptions(root, {
      widths: [40],
      formats: ['webp'],
      concurrency: 1,
    })
    const first = new ImageBuildRegistry(options, '/', 'production')
    first.register(source as any, 40, 'webp', 75)
    const request = first.requests()[0]!
    await first.finalize(path.join(root, 'dist/first'))
    const cacheFile = path.join(
      options.cacheDirectory,
      request.key.slice(0, 2),
      `${request.key}.${request.format}`,
    )
    const original = await fs.readFile(cacheFile)
    await fs.writeFile(cacheFile, Buffer.alloc(original.length))

    const second = new ImageBuildRegistry(options, '/', 'production')
    second.register(source as any, 40, 'webp', 75)
    await second.finalize(path.join(root, 'dist/second'))
    expect(second.stats()).toMatchObject({ coldTransforms: 1, cacheHits: 0 })
    expect(await fs.readFile(cacheFile)).toEqual(original)
  })

  it('shares concurrent cache creation for the same transform key', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    let creates = 0
    const create = async () => {
      creates += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return Buffer.from('encoded-image')
    }
    const [first, second] = await Promise.all([
      cachedBuffer(root, 'a'.repeat(64), 'webp', create),
      cachedBuffer(root, 'a'.repeat(64), 'webp', create),
    ])
    expect(creates).toBe(1)
    expect([first.hit, second.hit].sort()).toEqual([false, true])
  })

  it('upgrades legacy checksum metadata once, then keeps the stat-bound identity', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-cache-upgrade-'))
    temporaryDirectories.push(root)
    const key = 'b'.repeat(64)
    const data = Buffer.from('encoded-image')
    const first = await cachedBuffer(root, key, 'webp', async () => data)
    const metadataFile = `${first.file}.json`
    await fs.writeFile(metadataFile, JSON.stringify({
      version: 1,
      bytes: data.length,
      checksum: crypto.createHash('sha256').update(data).digest('hex'),
    }))

    const create = vi.fn(async () => data)
    const warm = await cachedBuffer(root, key, 'webp', create)
    expect(warm.hit).toBe(true)
    expect(create).not.toHaveBeenCalled()
    expect(JSON.parse(await fs.readFile(metadataFile, 'utf8'))).toMatchObject({
      version: 2,
      bytes: data.length,
      checksum: crypto.createHash('sha256').update(data).digest('hex'),
      device: expect.stringMatching(/^\d+$/),
      inode: expect.stringMatching(/^\d+$/),
      mtimeNs: expect.stringMatching(/^\d+$/),
    })
  })

  it('keeps metadata validation fast after build output hard-links come and go', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-cache-link-'))
    temporaryDirectories.push(root)
    const key = 'd'.repeat(64)
    const data = Buffer.from('encoded-image')
    const first = await cachedBuffer(root, key, 'webp', async () => data)
    const output = path.join(root, 'output.webp')
    await fs.link(first.file, output)
    await fs.rm(output)
    const metadataFile = `${first.file}.json`
    const metadata = JSON.parse(await fs.readFile(metadataFile, 'utf8'))
    await fs.writeFile(metadataFile, JSON.stringify({ ...metadata, checksum: '0'.repeat(64) }))

    const create = vi.fn(async () => data)
    const warm = await cachedBuffer(root, key, 'webp', create)
    expect(warm.hit).toBe(true)
    expect(warm.data).toEqual(data)
    expect(create).not.toHaveBeenCalled()
  })

  it('offers full checksum verification even when cache metadata is tampered to match', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-cache-checksum-'))
    temporaryDirectories.push(root)
    const key = 'c'.repeat(64)
    const original = Buffer.from('encoded-image')
    const first = await cachedBuffer(root, key, 'webp', async () => original)
    await fs.writeFile(first.file, Buffer.alloc(original.length, 1))
    const stat = await fs.stat(first.file, { bigint: true })
    const metadataFile = `${first.file}.json`
    const metadata = JSON.parse(await fs.readFile(metadataFile, 'utf8'))
    await fs.writeFile(metadataFile, JSON.stringify({
      ...metadata,
      device: stat.dev.toString(),
      inode: stat.ino.toString(),
      mtimeNs: stat.mtimeNs.toString(),
    }))

    const create = vi.fn(async () => original)
    const verified = await cachedBuffer(root, key, 'webp', create, 'checksum')
    expect(verified.hit).toBe(false)
    expect(verified.data).toEqual(original)
    expect(create).toHaveBeenCalledOnce()
  })

  it('prunes the oldest complete cache entries to deterministic byte and entry bounds', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-cache-prune-'))
    temporaryDirectories.push(root)
    const files: string[] = []
    for (const [index, character] of ['1', '2', '3', '4'].entries()) {
      const cached = await cachedBuffer(
        root,
        character.repeat(64),
        'webp',
        async () => Buffer.alloc(32, index),
      )
      files.push(cached.file)
      const accessedAt = new Date(Date.UTC(2020, 0, index + 1))
      await fs.utimes(`${cached.file}.json`, accessedAt, accessedAt)
    }

    const pruned = await pruneImageCache(root, {
      maxBytes: Number.MAX_SAFE_INTEGER,
      maxEntries: 2,
    })
    expect(pruned.entries).toBe(2)
    await expect(fs.stat(files[0]!)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.stat(files[1]!)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(fs.stat(files[2]!)).resolves.toMatchObject({ size: 32 })
    await expect(fs.stat(files[3]!)).resolves.toMatchObject({ size: 32 })

    const sizePruned = await pruneImageCache(root, { maxBytes: 1, maxEntries: 2 })
    expect(sizePruned.entries).toBe(2)
    expect(sizePruned.bytes).toBeGreaterThan(64)
  })

  it('never prunes the active working set when it exceeds the cache limits', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-cache-active-'))
    temporaryDirectories.push(root)
    const keys = ['5', '6', '7'].map((character) => character.repeat(64))
    const files = await Promise.all(keys.map(async (key) => (
      await cachedBuffer(root, key, 'webp', async () => Buffer.alloc(32))
    ).file))

    expect(await pruneImageCache(
      root,
      { maxBytes: 1, maxEntries: 1 },
      new Set(keys),
    )).toEqual({ entries: 0, bytes: 0 })
    await Promise.all(files.map((file) => expect(fs.stat(file)).resolves.toMatchObject({ size: 32 })))
  })

  it('content image rewriter honors per-use data-nib-widths and authored sizes', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-content-'))
    temporaryDirectories.push(root)
    const publicDir = path.join(root, 'src/assets/site-assets')
    await fs.mkdir(publicDir, { recursive: true })
    const sourceFile = path.join(publicDir, 'photo.jpg')
    // 1600x800 source: the authored [480,800,1200] ladder must cap both
    // responsive candidates and intrinsic layout dimensions at 1200px.
    await sharp({
      create: { width: 1600, height: 800, channels: 3, background: '#336699' },
    }).jpeg().toFile(sourceFile)
    const options = normalizeImagesOptions(root, {
      formats: ['avif', 'webp'],
      widths: [320, 640, 1280],
      content: [{
        publicPath: '/site-assets/',
        directory: 'src/assets/site-assets',
        widths: [320, 640, 1280],
        sizes: '(min-width: 900px) 860px, 100vw',
      }],
    })
    const registry = new ImageBuildRegistry(options, '/', 'production')
    const clientDirectory = path.join(root, 'dist/client')
    const pageFile = path.join(clientDirectory, 'photos')
    await fs.mkdir(clientDirectory, { recursive: true })
    await fs.writeFile(pageFile, [
      '<figure>',
      '<img src="/site-assets/photo.jpg" alt="A photo" data-nib-widths="480, 800, 1200" sizes="(min-width: 1280px) 25vw, 100vw" loading="lazy" decoding="async" fetchpriority="low" style="--pin-ratio: 2; max-width: 18rem; max-height: 22rem">',
      '</figure>',
    ].join('\n'))
    const replacements = await optimizeContentImages(
      clientDirectory,
      '/',
      options,
      registry,
      pageArtifact('photos'),
    )
    expect(replacements).toBe(1)
    const rewritten = await fs.readFile(pageFile, 'utf8')
    expect(rewritten).toContain('<picture>')
    // Authored ladder is preserved as width descriptors.
    expect(rewritten).toContain(' 480w')
    expect(rewritten).toContain(' 800w')
    expect(rewritten).toContain(' 1200w')
    // Default-width descriptors are not emitted alongside the authored ladder.
    expect(rewritten).not.toContain(' 1280w')
    expect(rewritten).not.toContain(' 320w')
    // Authored sizes pass through verbatim.
    expect(rewritten).toContain('sizes="(min-width: 1280px) 25vw, 100vw"')
    // Intrinsic dimensions use the per-use cap and preserve the aspect ratio.
    expect(rewritten).toContain('width="1200"')
    expect(rewritten).toContain('height="600"')
    expect(rewritten).not.toContain(' 1600w')
    // The internal hint attribute does not leak into the optimized output.
    expect(rewritten).not.toContain('data-nib-widths')
    expect(rewritten).toContain('fetchPriority="low"')
    expect(rewritten).toContain('--pin-ratio: 2; max-width: 18rem; max-height: 22rem')
  })

  it('content image rewriter separates display width from its responsive ladder', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-content-width-'))
    temporaryDirectories.push(root)
    const publicDir = path.join(root, 'src/assets/site-assets')
    await fs.mkdir(publicDir, { recursive: true })
    const sourceFile = path.join(publicDir, 'photo.jpg')
    await sharp({
      create: { width: 1600, height: 800, channels: 3, background: '#336699' },
    }).jpeg().toFile(sourceFile)
    const options = normalizeImagesOptions(root, {
      formats: ['avif', 'webp'],
      content: [{
        publicPath: '/site-assets/',
        directory: 'src/assets/site-assets',
      }],
    })
    const registry = new ImageBuildRegistry(options, '/', 'production')
    const clientDirectory = path.join(root, 'dist/client')
    const pageFile = path.join(clientDirectory, 'photos')
    await fs.mkdir(clientDirectory, { recursive: true })
    await fs.writeFile(pageFile, [
      '<img src="/site-assets/photo.jpg" alt="A photo" width="504" data-nib-width="504" data-nib-widths="240, 320, 480, 640, 960" sizes="504px">',
    ].join('\n'))

    const replacements = await optimizeContentImages(
      clientDirectory,
      '/',
      options,
      registry,
      pageArtifact('photos'),
    )
    expect(replacements).toBe(1)
    const rewritten = await fs.readFile(pageFile, 'utf8')
    expect(rewritten).toContain('width="504"')
    expect(rewritten).toContain('height="252"')
    expect(rewritten).toContain(' 960w')
    expect(rewritten).not.toContain(' 1200w')
    expect(rewritten).toContain('sizes="504px"')
    expect(rewritten).not.toContain('data-nib-width')
  })

  it('rewrites only real local image elements, never raw-text markup or external URLs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-content-html-'))
    temporaryDirectories.push(root)
    const publicDir = path.join(root, 'src/assets/site-assets')
    await fs.mkdir(publicDir, { recursive: true })
    await sharp({
      create: { width: 80, height: 40, channels: 3, background: '#336699' },
    }).jpeg().toFile(path.join(publicDir, 'photo.jpg'))
    await fs.writeFile(path.join(publicDir, 'art-directed.jpg'), 'art-directed-source')
    const options = normalizeImagesOptions(root, {
      formats: ['webp'],
      widths: [40],
      content: [{
        publicPath: '/site-assets/',
        directory: 'src/assets/site-assets',
      }],
    })
    const registry = new ImageBuildRegistry(options, '/journal/', 'production')
    const clientDirectory = path.join(root, 'dist/client')
    const pageFile = path.join(clientDirectory, 'article')
    await fs.mkdir(clientDirectory, { recursive: true })
    const protectedMarkup = [
      '<!-- <img src="/site-assets/photo.jpg" alt="Comment"> -->',
      '<script>const markup = \'<img src="/site-assets/photo.jpg" alt="Script">\';</script>',
      '<style>.example::after { content: \'<img src="/site-assets/photo.jpg" alt="Style">\'; }</style>',
      '<textarea><img src="/site-assets/photo.jpg" alt="Textarea"></textarea>',
      '<img src="https://cdn.example/site-assets/photo.jpg" alt="External">',
      '<img src="//cdn.example/site-assets/photo.jpg" alt="Protocol relative">',
    ]
    const artDirectedMarkup =
      '<picture><source srcset="data:image/svg+xml,%3Csvg%3E 1x, /site-assets/art-directed.jpg 2x"><img src="/site-assets/photo.jpg" alt="Art directed"></picture>'
    await fs.writeFile(pageFile, [
      ...protectedMarkup,
      artDirectedMarkup,
      '<img src="/site-assets/photo.jpg" alt="Local">',
    ].join('\n'))

    expect(await optimizeContentImages(
      clientDirectory,
      '/journal/',
      options,
      registry,
      pageArtifact('article'),
    )).toBe(1)

    const rewritten = await fs.readFile(pageFile, 'utf8')
    for (const markup of protectedMarkup) expect(rewritten).toContain(markup)
    expect(rewritten.match(/<picture>/g)).toHaveLength(2)
    expect(rewritten).toContain(
      '<picture><source srcset="data:image/svg+xml,%3Csvg%3E 1x, /journal/site-assets/art-directed.jpg 2x"><img src="/journal/site-assets/photo.jpg" alt="Art directed"></picture>',
    )
    expect(rewritten).not.toContain('<picture><source srcset="data:image/svg+xml,%3Csvg%3E 1x, /journal/site-assets/art-directed.jpg 2x"><picture>')
    expect(rewritten).toContain('/journal/assets/nib/')
    await expect(fs.readFile(
      path.join(clientDirectory, 'site-assets/art-directed.jpg'),
      'utf8',
    )).resolves.toBe('art-directed-source')
  })

  it('keeps non-root content URLs and physical artifacts aligned without duplicating the base', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-base-content-'))
    temporaryDirectories.push(root)
    const publicDir = path.join(root, 'src/assets/site-assets')
    await fs.mkdir(publicDir, { recursive: true })
    await sharp({
      create: { width: 80, height: 40, channels: 3, background: '#336699' },
    }).jpeg().toFile(path.join(publicDir, 'photo.jpg'))
    const options = normalizeImagesOptions(root, {
      formats: ['webp'],
      widths: [40, 80],
      content: [{
        publicPath: '/site-assets/',
        directory: 'src/assets/site-assets',
      }],
    })
    const registry = new ImageBuildRegistry(options, '/journal/', 'production')
    const clientDirectory = path.join(root, 'dist/client')
    const pageFile = path.join(clientDirectory, 'posts/index.html')
    await fs.mkdir(path.dirname(pageFile), { recursive: true })
    await fs.writeFile(pageFile, [
      '<a href="/site-assets/photo.jpg">Original</a>',
      '<img src="/site-assets/photo.jpg" alt="Photo">',
      '<img src="/journal/site-assets/photo.jpg" alt="Already based">',
    ].join('\n'))

    expect(await optimizeContentImages(
      clientDirectory,
      '/journal/',
      options,
      registry,
      pageArtifact('posts/index.html'),
    )).toBe(2)
    const rewritten = await fs.readFile(pageFile, 'utf8')
    expect(rewritten).toContain('href="/journal/site-assets/photo.jpg"')
    expect(rewritten).toContain('/journal/assets/nib/')
    expect(rewritten).not.toContain('/journal/journal/')
    await expect(fs.access(path.join(clientDirectory, 'site-assets/photo.jpg')))
      .resolves.toBeUndefined()
    await expect(fs.access(path.join(clientDirectory, 'journal/site-assets/photo.jpg')))
      .rejects.toThrow()
  })

  it.each([
    { base: '/', expected: '/site-assets/photo.jpg' },
    { base: '/journal/', expected: '/journal/site-assets/photo.jpg' },
  ])('restores a failed transform to a deployed original under $base', async ({ base, expected }) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-fallback-'))
    temporaryDirectories.push(root)
    const publicDir = path.join(root, 'src/assets/site-assets')
    await fs.mkdir(publicDir, { recursive: true })
    const sourceFile = path.join(publicDir, 'photo.jpg')
    await sharp({
      create: { width: 80, height: 40, channels: 3, background: '#336699' },
    }).jpeg().toFile(sourceFile)
    const options = normalizeImagesOptions(root, {
      formats: ['webp'],
      widths: [40],
      content: [{
        publicPath: '/site-assets/',
        directory: 'src/assets/site-assets',
      }],
    })
    const registry = new ImageBuildRegistry(options, base, 'production')
    const clientDirectory = path.join(root, 'dist/client')
    const pageFile = path.join(clientDirectory, 'article')
    await fs.mkdir(clientDirectory, { recursive: true })
    await fs.writeFile(pageFile, '<img src="/site-assets/photo.jpg" alt="Photo">')
    const routes = pageArtifact('article')
    await optimizeContentImages(clientDirectory, base, options, registry, routes)
    const optimized = await fs.readFile(pageFile, 'utf8')
    const failedUrl = optimized.match(/\/(?:journal\/)?assets\/nib\/[^ "'>,]+/)?.[0]
    if (!failedUrl) throw new Error('Expected optimized content image URL')
    const protectedMarkup = [
      `<!-- <img src="${failedUrl}" alt="Comment"> -->`,
      `<script>const markup = '<img src="${failedUrl}" alt="Script">';</script>`,
      `<style>.example::after { content: '<img src="${failedUrl}" alt="Style">'; }</style>`,
      `<textarea><img src="${failedUrl}" alt="Textarea"></textarea>`,
    ]
    await fs.writeFile(pageFile, [optimized, ...protectedMarkup].join('\n'))
    await fs.writeFile(sourceFile, 'corrupt after inspection')
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await registry.finalize(clientDirectory)
    expect(await restoreFailedContentImages(clientDirectory, registry, routes)).toBeGreaterThan(0)

    const restored = await fs.readFile(pageFile, 'utf8')
    expect(restored).toContain(`src="${expected}"`)
    for (const markup of protectedMarkup) expect(restored).toContain(markup)
    expect(restored.split(failedUrl)).toHaveLength(protectedMarkup.length + 1)
    await expect(fs.access(path.join(clientDirectory, 'site-assets/photo.jpg')))
      .resolves.toBeUndefined()
    warning.mockRestore()
  })

  it('rejects traversal and escaping symlinks for authored content', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-content-boundary-'))
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-content-outside-'))
    temporaryDirectories.push(root, outside)
    const publicDir = path.join(root, 'src/assets/site-assets')
    await fs.mkdir(publicDir, { recursive: true })
    await fs.writeFile(path.join(outside, 'secret.jpg'), 'secret')
    await fs.symlink(path.join(outside, 'secret.jpg'), path.join(publicDir, 'link.jpg'))
    const options = normalizeImagesOptions(root, {
      content: [{
        publicPath: '/site-assets/',
        directory: 'src/assets/site-assets',
      }],
    })
    const clientDirectory = path.join(root, 'dist/client')
    const pageFile = path.join(clientDirectory, 'article')
    await fs.mkdir(clientDirectory, { recursive: true })
    await fs.writeFile(pageFile, [
      '<a href="/site-assets/%2e%2e/secret.jpg">Traversal</a>',
      '<a href="/site-assets/link.jpg">Symlink</a>',
    ].join('\n'))

    await expect(optimizeContentImages(
      clientDirectory,
      '/',
      options,
      new ImageBuildRegistry(options, '/', 'production'),
      pageArtifact('article'),
    )).rejects.toThrow('escapes its configured directory')
    await expect(fs.access(path.join(clientDirectory, 'secret.jpg'))).rejects.toThrow()
  })
})
