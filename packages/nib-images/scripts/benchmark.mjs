import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import {
  ImageBuildRegistry,
  createImageSource,
  normalizeImagesOptions,
} from '../dist/internal.js'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-images-benchmark-'))

try {
  const file = path.join(root, 'benchmark.png')
  await sharp({
    create: { width: 1920, height: 1080, channels: 3, background: '#247ba0' },
  }).png().toFile(file)
  const source = createImageSource({
    __nibImage: true,
    __nibFile: file,
    __nibSourceId: 'a'.repeat(24),
    __nibStem: 'benchmark',
    width: 1920,
    height: 1080,
    format: 'png',
    hasAlpha: false,
    animated: false,
    fingerprint: crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'),
  })
  const options = normalizeImagesOptions(root, {
    widths: [480, 960, 1440, 1920],
    formats: ['avif', 'webp'],
    concurrency: 2,
  })
  const run = async (name) => {
    const registry = new ImageBuildRegistry(options, '/', 'production')
    for (const width of options.widths) {
      registry.register(source, width, 'avif', options.quality.avif)
      registry.register(source, width, 'webp', options.quality.webp)
      registry.register(source, width, 'jpeg', options.quality.jpeg)
    }
    const started = performance.now()
    await registry.finalize(path.join(root, `dist-${name}`))
    return { elapsedMs: Math.round(performance.now() - started), ...registry.stats() }
  }

  console.table({ cold: await run('cold'), warm: await run('warm') })
} finally {
  await fs.rm(root, { recursive: true, force: true })
}
