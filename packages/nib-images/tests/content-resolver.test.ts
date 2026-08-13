import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { build as viteBuild } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { imageVitePlugin } from '../src/image-vite-plugin'
import type { ImageSource } from '../src/image-source'
import { normalizeImagesOptions } from '../src/options'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, {
    recursive: true,
    force: true,
  })))
})

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  temporaryDirectories.push(root)
  return root
}

async function generatedModule(
  root: string,
  content: Array<{ publicPath: string; directory: string }>,
): Promise<{
  code: string
  warnings: ReturnType<typeof vi.fn>
  watched: ReturnType<typeof vi.fn>
}> {
  const plugin = imageVitePlugin(normalizeImagesOptions(root, { content }), 'server')
  if (typeof plugin.resolveId !== 'function') throw new Error('Missing resolve hook')
  const id = await plugin.resolveId.call(
    { environment: { name: 'ssr' } } as never,
    '@briansunter/nib-images/content',
    undefined,
    { isEntry: false },
  )
  if (typeof id !== 'string') throw new Error('Content entry did not resolve')
  if (typeof plugin.load !== 'function') throw new Error('Missing load hook')
  const watched = vi.fn()
  const warnings = vi.fn()
  const loaded = await plugin.load.call(
    { environment: { name: 'ssr' }, addWatchFile: watched, warn: warnings } as never,
    id,
  )
  if (typeof loaded !== 'string') throw new Error('Content entry did not load')
  return { code: loaded, warnings, watched }
}

async function executeGeneratedModule(code: string): Promise<{
  resolveContentImage(publicPath: string | null | undefined): ImageSource | undefined
}> {
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

describe('configured content image resolver', () => {
  it('generates a deterministic resolver from configured content roots', async () => {
    const root = await temporaryRoot('nib-content-resolver-')
    const assets = path.join(root, 'src/assets/site-assets')
    await fs.mkdir(path.join(assets, 'art'), { recursive: true })
    await sharp({
      create: { width: 20, height: 10, channels: 3, background: '#336699' },
    }).png().toFile(path.join(assets, 'hero image.png'))
    await sharp({
      create: { width: 8, height: 16, channels: 3, background: '#663399' },
    }).jpeg().toFile(path.join(assets, 'art/piece.JPG'))
    await fs.writeFile(path.join(assets, 'corrupt.png'), 'not an image')
    await fs.writeFile(path.join(assets, 'notes.txt'), '')

    const { code, warnings, watched } = await generatedModule(root, [{
      publicPath: '/site-assets/',
      directory: 'src/assets/site-assets',
    }])
    expect(code).toContain('/site-assets/art/piece.JPG')
    expect(code).toContain('/site-assets/hero image.png')
    expect(code).not.toContain('/site-assets/corrupt.png')
    expect(code).not.toContain('notes.txt')
    expect(code.indexOf('/site-assets/art/piece.JPG'))
      .toBeLessThan(code.indexOf('/site-assets/hero image.png'))
    expect(watched).toHaveBeenCalledWith(assets)
    expect(warnings).toHaveBeenCalledWith(expect.stringContaining(
      'omitting /site-assets/corrupt.png after source inspection failure',
    ))

    const module = await executeGeneratedModule(code)
    expect(module.resolveContentImage('/site-assets/art/piece.JPG')).toMatchObject({
      width: 8,
      height: 16,
      format: 'jpeg',
    })
    expect(module.resolveContentImage('/site-assets/hero%20image.png')).toMatchObject({
      width: 20,
      height: 10,
      format: 'png',
    })
    expect(module.resolveContentImage('/site-assets/corrupt.png')).toBeUndefined()
    expect(module.resolveContentImage('/site-assets/missing.png')).toBeUndefined()
    for (const invalid of [
      '//site-assets/hero image.png',
      '/site-assets//hero image.png',
      '/site-assets/../hero image.png',
      '/site-assets/%2e%2e/hero image.png',
      '/site-assets/art%2Fpiece.JPG',
      '/site-assets/art%2fpiece.JPG',
      '/site-assets/art%5Cpiece.JPG',
      '/site-assets/hero image.png?raw',
      '/site-assets/hero image.png#detail',
      '/site-assets/hero%ZZimage.png',
      '/site-assets/hero%00image.png',
    ]) {
      expect(module.resolveContentImage(invalid), invalid).toBeUndefined()
    }
    expect(module.resolveContentImage(null as never)).toBeUndefined()
  })

  it('rejects duplicate public mappings across overlapping content roots', async () => {
    const root = await temporaryRoot('nib-content-duplicate-')
    await fs.mkdir(path.join(root, 'first/photos'), { recursive: true })
    await fs.mkdir(path.join(root, 'second'), { recursive: true })
    await fs.writeFile(path.join(root, 'first/photos/hero.png'), '')
    await fs.writeFile(path.join(root, 'second/hero.png'), '')

    await expect(generatedModule(root, [
      { publicPath: '/site-assets/', directory: 'first' },
      { publicPath: '/site-assets/photos/', directory: 'second' },
    ])).rejects.toThrow('duplicate content image public path /site-assets/photos/hero.png')
  })

  it('rejects filenames that cannot form an unambiguous public URL', async () => {
    const root = await temporaryRoot('nib-content-invalid-')
    await fs.mkdir(path.join(root, 'assets'), { recursive: true })
    await fs.writeFile(path.join(root, 'assets/bad%2Fname.png'), '')

    await expect(generatedModule(root, [
      { publicPath: '/site-assets/', directory: 'assets' },
    ])).rejects.toThrow('invalid content image filename')
  })

  it('rejects configured content roots whose real path is not allowed', async () => {
    const root = await temporaryRoot('nib-content-root-boundary-')
    const outside = await temporaryRoot('nib-content-root-outside-')
    await sharp({
      create: { width: 12, height: 6, channels: 3, background: '#335577' },
    }).png().toFile(path.join(outside, 'secret.png'))
    await fs.symlink(outside, path.join(root, 'assets'))

    await expect(generatedModule(root, [
      { publicPath: '/media/', directory: 'assets' },
    ])).rejects.toThrow('content directory resolves outside allowedSourceRoots')
  })

  it('builds the public entry in a real server graph and omits corrupt sources', async () => {
    const root = await temporaryRoot('nib-content-vite-')
    const assets = path.join(root, 'assets')
    const output = path.join(root, 'dist')
    await fs.mkdir(assets, { recursive: true })
    await sharp({
      create: { width: 24, height: 12, channels: 3, background: '#224466' },
    }).png().toFile(path.join(assets, 'valid.png'))
    await fs.writeFile(path.join(assets, 'corrupt.png'), 'not an image')
    const entry = path.join(root, 'entry.ts')
    await fs.writeFile(entry, [
      "import { resolveContentImage } from '@briansunter/nib-images/content'",
      "const valid = resolveContentImage('/media/valid.png')",
      "const corrupt = resolveContentImage('/media/corrupt.png')",
      "const unsafe = resolveContentImage('/media/../valid.png')",
      "const encodedSeparator = resolveContentImage('/media%2Fvalid.png')",
      'export default {',
      '  width: valid?.width,',
      '  format: valid?.format,',
      '  corrupt: corrupt === undefined,',
      '  unsafe: unsafe === undefined,',
      '  encodedSeparator: encodedSeparator === undefined,',
      '}',
    ].join('\n'))

    await viteBuild({
      configFile: false,
      root,
      logLevel: 'silent',
      plugins: [imageVitePlugin(normalizeImagesOptions(root, {
        content: [{ publicPath: '/media/', directory: 'assets' }],
      }), 'server')],
      build: {
        ssr: entry,
        outDir: output,
        emptyOutDir: true,
        rollupOptions: { output: { entryFileNames: 'entry.mjs' } },
      },
    })

    const built = await import(`${pathToFileURL(path.join(output, 'entry.mjs')).href}?test=${Date.now()}`)
    expect(built.default).toEqual({
      width: 24,
      format: 'png',
      corrupt: true,
      unsafe: true,
      encodedSeparator: true,
    })
  })

  it('invalidates and regenerates the catalog for nested file creation and deletion', async () => {
    const root = await temporaryRoot('nib-content-hot-')
    const assets = path.join(root, 'assets')
    const nested = path.join(assets, 'nested')
    const file = path.join(nested, 'new.png')
    await fs.mkdir(nested, { recursive: true })

    const content = [{ publicPath: '/media/', directory: 'assets' }]
    expect((await generatedModule(root, content)).code).not.toContain('/media/nested/new.png')
    await sharp({
      create: { width: 10, height: 5, channels: 3, background: '#446688' },
    }).png().toFile(file)
    expect((await generatedModule(root, content)).code).toContain('/media/nested/new.png')

    const plugin = imageVitePlugin(normalizeImagesOptions(root, { content }), 'development')
    if (typeof plugin.hotUpdate !== 'function') throw new Error('Missing hot-update hook')
    const contentModule = { id: '\0@briansunter/nib-images/content' }
    const invalidateModule = vi.fn()
    const pluginContext = {
      environment: {
        moduleGraph: {
          getModuleById: vi.fn(() => contentModule),
          invalidateModule,
        },
      },
    }
    const created = await plugin.hotUpdate.call(pluginContext as never, {
      type: 'create',
      file,
      timestamp: 100,
      modules: [],
      read: () => '',
      server: {} as never,
    })
    expect(created).toEqual([contentModule])
    expect(invalidateModule).toHaveBeenCalledWith(
      contentModule,
      expect.any(Set),
      100,
      true,
    )

    await fs.rm(file)
    const deleted = await plugin.hotUpdate.call(pluginContext as never, {
      type: 'delete',
      file,
      timestamp: 101,
      modules: [],
      read: () => '',
      server: {} as never,
    })
    expect(deleted).toEqual([contentModule])
    expect((await generatedModule(root, content)).code).not.toContain('/media/nested/new.png')
  })
})
