import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { Image } from '../src/image-component'
import { ImageRegistryProvider } from '../src/image-context'
import { ImageBuildRegistry } from '../src/image-registry'
import { createImageSource } from '../src/image-source'
import { imageVitePlugin } from '../src/image-vite-plugin'
import { normalizeImagesOptions } from '../src/options'
import { cachedBuffer } from '../src/cache'

const temporaryDirectories: string[] = []

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
  })

  it('rejects image metadata imports from client and island graphs', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const options = normalizeImagesOptions(root)
    const plugin = imageVitePlugin(options, 'client')
    const resolveId = plugin.resolveId
    if (typeof resolveId !== 'function') throw new Error('Image Vite plugin has no resolve hook')
    expect(() => resolveId.call(
      { environment: { name: 'client' } } as any,
      '@briansunter/nib-images',
      '/src/islands/gallery.tsx',
      { isEntry: false },
    )).toThrow('cannot be included in a React island')
    const load = plugin.load as (...args: any[]) => unknown
    await expect(load.call(
      { environment: { name: 'client' } },
      path.join(root, 'hero.png?nib-image'),
    )).rejects.toThrow('cannot be included in a React island')
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
    expect(html).toContain('sizes="100vw"')
    expect(html).not.toContain('data-nib-islands')
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
})
