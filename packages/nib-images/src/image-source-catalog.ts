import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { InternalImageSource, SourceImageFormat } from './image-source'
import { isAllowedSource, type NormalizedImagesOptions } from './options'

const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'])

function isSourceImageFormat(value: string): value is SourceImageFormat {
  return value === 'jpeg'
    || value === 'png'
    || value === 'webp'
    || value === 'avif'
    || value === 'gif'
    || value === 'svg'
}

function digest(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function imageFormat(format: string | undefined, file: string): SourceImageFormat {
  const normalized = format === 'jpg' ? 'jpeg' : format
  if (normalized && isSourceImageFormat(normalized)) {
    return normalized
  }
  throw new Error(`@briansunter/nib-images: unsupported image format: ${file}`)
}

function sourceId(file: string): string {
  return digest(path.resolve(file)).slice(0, 24)
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
    __nibStem: path.basename(file, path.extname(file)),
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

/** Authorizes, inspects, and refreshes Vite-imported image sources. */
export class ImageSourceCatalog {
  readonly #sources = new Map<string, InternalImageSource>()
  readonly #refreshes = new Map<string, Promise<void>>()
  readonly #allowedRoots: Promise<string[]>

  constructor(options: NormalizedImagesOptions) {
    this.#allowedRoots = Promise.all(options.allowedSourceRoots.map(async (root) => {
      try {
        return await fs.realpath(root)
      } catch {
        return root
      }
    }))
  }

  get(id: string): InternalImageSource | undefined {
    return this.#sources.get(id)
  }

  async load(file: string): Promise<InternalImageSource> {
    const resolved = await fs.realpath(path.resolve(file))
    if (!supportedExtensions.has(path.extname(resolved).toLowerCase())) {
      throw new Error(`@briansunter/nib-images: unsupported image file ${resolved}`)
    }
    if (!isAllowedSource(resolved, await this.#allowedRoots)) {
      throw new Error(`@briansunter/nib-images: source is outside allowedSourceRoots: ${resolved}`)
    }
    const source = await inspectImage(resolved)
    this.#sources.set(source.__nibSourceId, source)
    return source
  }

  async refresh(file: string): Promise<void> {
    const unresolved = path.resolve(file)
    const changed = await fs.realpath(unresolved).catch(() => unresolved)
    const id = sourceId(changed)
    if (!this.#sources.has(id)) return
    const existing = this.#refreshes.get(changed)
    if (existing) return existing
    const refresh = (async () => {
      const source = await inspectHotImage(changed)
      this.#sources.set(source.__nibSourceId, source)
    })()
    this.#refreshes.set(changed, refresh)
    try {
      await refresh
    } finally {
      this.#refreshes.delete(changed)
    }
  }
}
