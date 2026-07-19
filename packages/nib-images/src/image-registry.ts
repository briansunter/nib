import path from 'node:path'
import { linkOrCopy } from './cache'
import { ImageTransformExecutor } from './image-executor'
import {
  createImageTransformRequest,
  developmentImageUrl,
  type ImageTransformRequest,
} from './image-request'
import {
  isImageSource,
  type ImageFormat,
  type InternalImageSource,
  type SourceImageFormat,
} from './image-source'
import type { NormalizedImagesOptions } from './options'

export interface ImageBuildStats {
  coldTransforms: number
  cacheHits: number
  bytesWritten: number
  peakTransforms: number
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

/** Collects output requests during SSR, then materializes them after all routes
 * have rendered. */
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
    if (this.#finalized) {
      throw new Error('@briansunter/nib-images: registry cannot register after finalization')
    }
    if (!isImageSource(source)) {
      throw new Error('@briansunter/nib-images: invalid image source')
    }
    const request = createImageTransformRequest(source, width, format, quality, passthrough)
    if (!this.#requests.has(request.key)) this.#requests.set(request.key, request)
    if (this.mode === 'development') return developmentImageUrl(this.base, request)
    return `${this.base}assets/nib/${request.filename}`
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
    const executor = new ImageTransformExecutor({
      concurrency: this.options.concurrency,
      reuseSourcePipelines: true,
      onActive: (active) => {
        this.#stats.peakTransforms = Math.max(this.#stats.peakTransforms, active)
      },
    })
    await mapWithConcurrency(this.requests(), 32, async (request) => {
      const cached = await executor.cachedFile(this.options.cacheDirectory, request)
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
