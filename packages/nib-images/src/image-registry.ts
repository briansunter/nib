import crypto from 'node:crypto'
import path from 'node:path'
import { cachedFile, linkOrCopy } from './cache'
import {
  isImageSource,
  type ImageFormat,
  type InternalImageSource,
  type SourceImageFormat,
} from './image-source'
import type { NormalizedImagesOptions } from './options'
import {
  IMAGE_PROCESSOR_ID,
  sourcePipeline,
  transformFromPipeline,
  transformImage,
} from './processor'
import { createTaskQueue } from './concurrency'

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
  peakTransforms: number
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
    cacheSchema: 2,
    processor: IMAGE_PROCESSOR_ID,
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
  readonly #stats: ImageBuildStats = {
    coldTransforms: 0,
    cacheHits: 0,
    bytesWritten: 0,
    peakTransforms: 0,
  }
  #finalized = false

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
    if (!isImageSource(source)) {
      throw new Error('@briansunter/nib-images: invalid image source')
    }
    if (!Number.isSafeInteger(width) || width <= 0 || width > source.width) {
      throw new Error(`@briansunter/nib-images: width must be an integer from 1 to ${source.width}`)
    }
    if (!Number.isSafeInteger(quality) || quality < 1 || quality > 100) {
      throw new Error('@briansunter/nib-images: quality must be an integer from 1 to 100')
    }
    if (passthrough) {
      if (width !== source.width || format !== source.format || quality !== 100) {
        throw new Error('@briansunter/nib-images: pass-through requests must preserve the source')
      }
    } else if (!['avif', 'webp', 'jpeg', 'png'].includes(format)) {
      throw new Error(`@briansunter/nib-images: cannot transform to ${format}`)
    }
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
    if (this.#finalized) {
      throw new Error('@briansunter/nib-images: registry can only finalize once')
    }
    this.#finalized = true
    const started = performance.now()
    const pipelines = new Map<string, ReturnType<typeof sourcePipeline>>()
    const transform = createTaskQueue(this.options.concurrency, (peak) => {
      this.#stats.peakTransforms = Math.max(this.#stats.peakTransforms, peak)
    })
    await mapWithConcurrency(this.requests(), 32, async (request) => {
      const cached = await cachedFile(
        this.options.cacheDirectory,
        request.key,
        request.format,
        () => transform(() => {
          if (request.passthrough) {
            return transformImage(request.source, request.width, request.format, request.quality, true)
          }
          let pipeline = pipelines.get(request.source.fingerprint)
          if (pipeline === undefined) {
            pipeline = sourcePipeline(request.source)
            pipelines.set(request.source.fingerprint, pipeline)
          }
          return transformFromPipeline(
            pipeline.clone(),
            request.width,
            request.format as ImageFormat,
            request.quality,
          )
        }),
      )
      if (cached.hit) this.#stats.cacheHits += 1
      else this.#stats.coldTransforms += 1
      this.#stats.bytesWritten += cached.bytes
      await linkOrCopy(cached.file, path.join(clientDirectory, 'assets/nib', request.filename))
    })
    if (this.#requests.size > 0) {
      const elapsed = Math.round(performance.now() - started)
      console.info(
        `nib-images: ${this.#stats.coldTransforms} transformed, ${this.#stats.cacheHits} cached, ${this.#stats.bytesWritten} bytes (${elapsed}ms)`,
      )
    }
  }
}
