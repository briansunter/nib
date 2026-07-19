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
import { normalizeImagesOptions } from '../src/options'

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

  it('writes content-addressed transforms, then uses them on a warm run', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-'))
    temporaryDirectories.push(root)
    const source = await fixtureSource()
    const options = normalizeImagesOptions(root, { widths: [40, 80], formats: ['webp'], concurrency: 2 })
    const first = new ImageBuildRegistry(options, '/base/', 'production')
    first.register(source as any, 40, 'webp', 75)
    await first.finalize(path.join(root, 'dist/client'))
    expect(first.stats()).toMatchObject({ coldTransforms: 1, cacheHits: 0 })
    const output = await fs.readdir(path.join(root, 'dist/client/assets/nib'))
    expect(output).toHaveLength(1)

    const second = new ImageBuildRegistry(options, '/base/', 'production')
    second.register(source as any, 40, 'webp', 75)
    await second.finalize(path.join(root, 'dist/again'))
    expect(second.stats()).toMatchObject({ coldTransforms: 0, cacheHits: 1 })
  })
})
