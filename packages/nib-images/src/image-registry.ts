import crypto from 'node:crypto'
import path from 'node:path'
import { cachedBuffer, linkOrCopy } from './cache'
import type { ImageFormat, InternalImageSource, SourceImageFormat } from './image-source'
import type { NormalizedImagesOptions } from './options'
import { sourcePipeline, transformFromPipeline, transformImage } from './processor'

export interface ImageTransformRequest {
  readonly key: string
  readonly source: InternalImageSource
  readonly width: number
  readonly format: ImageFormat | SourceImageFormat
  readonly quality: number
  readonly passthrough: boolean
  readonly filename: string
}

export interface ImageBuildStats {
  coldTransforms: number
  cacheHits: number
  bytesWritten: number
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function safeStem(stem: string): string {
  const safe = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return (safe || 'image').slice(0, 48)
}

function assetName(source: InternalImageSource, key: string, width: number, format: string, passthrough: boolean): string {
  const suffix = passthrough ? '' : `-${width}`
  return `${safeStem(source.__nibStem)}.${key.slice(0, 12)}${suffix}.${format}`
}

export function requestKey(
  source: InternalImageSource,
  width: number,
  format: ImageFormat | SourceImageFormat,
  quality: number,
  passthrough: boolean,
): string {
  return hash(JSON.stringify({
    cacheSchema: 1,
    processor: 'sharp',
    source: source.fingerprint,
    width,
    format,
    quality,
    passthrough,
    alpha: source.hasAlpha,
    animated: source.animated,
  }))
}

async function mapWithConcurrency<Value>(
  values: readonly Value[],
  concurrency: number,
  callback: (value: Value) => Promise<void>,
): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(values.length, concurrency) }, async () => {
    while (next < values.length) {
      const current = values[next++]
      if (current !== undefined) await callback(current)
    }
  }))
}

export class ImageBuildRegistry {
  readonly #requests = new Map<string, ImageTransformRequest>()
  readonly #stats: ImageBuildStats = { coldTransforms: 0, cacheHits: 0, bytesWritten: 0 }

  constructor(
    private readonly options: NormalizedImagesOptions,
    private readonly base: string,
    private readonly mode: 'development' | 'production',
  ) {}

  register(
    source: InternalImageSource,
    width: number,
    format: ImageFormat | SourceImageFormat,
    quality: number,
    passthrough = false,
  ): string {
    const key = requestKey(source, width, format, quality, passthrough)
    const filename = assetName(source, key, width, format, passthrough)
    if (!this.#requests.has(key)) {
      this.#requests.set(key, { key, source, width, format, quality, passthrough, filename })
    }
    if (this.mode === 'development') {
      return `${this.base.replace(/\/$/, '')}/@nib-images/${source.__nibSourceId}/${width}-${quality}.${format}`
    }
    return `${this.base}assets/nib/${filename}`
  }

  requests(): readonly ImageTransformRequest[] {
    return [...this.#requests.values()]
  }

  stats(): Readonly<ImageBuildStats> {
    return this.#stats
  }

  defaults(): Pick<NormalizedImagesOptions, 'formats' | 'widths' | 'quality'> {
    return this.options
  }

  async finalize(clientDirectory: string): Promise<void> {
    const started = performance.now()
    const groups = new Map<string, ImageTransformRequest[]>()
    for (const request of this.requests()) {
      const group = groups.get(request.source.fingerprint) ?? []
      group.push(request)
      groups.set(request.source.fingerprint, group)
    }
    await mapWithConcurrency([...groups.values()], this.options.concurrency, async (requests) => {
      const pipeline = requests.some((request) => !request.passthrough)
        ? sourcePipeline(requests[0]!.source)
        : undefined
      await Promise.all(requests.map(async (request) => {
        const cached = await cachedBuffer(
          this.options.cacheDirectory,
          request.key,
          request.format,
          () => request.passthrough
            ? transformImage(request.source, request.width, request.format, request.quality, true)
            : transformFromPipeline(pipeline!.clone(), request.width, request.format as ImageFormat, request.quality),
        )
        if (cached.hit) this.#stats.cacheHits += 1
        else this.#stats.coldTransforms += 1
        this.#stats.bytesWritten += cached.data.length
        await linkOrCopy(cached.file, path.join(clientDirectory, 'assets/nib', request.filename))
      }))
    })
    if (this.#requests.size > 0) {
      const elapsed = Math.round(performance.now() - started)
      console.info(
        `nib-images: ${this.#stats.coldTransforms} transformed, ${this.#stats.cacheHits} cached, ${this.#stats.bytesWritten} bytes (${elapsed}ms)`,
      )
    }
  }
}
