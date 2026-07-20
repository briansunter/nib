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

export interface ContentImageFallback {
  readonly sourceFile: string
  readonly publicUrl: string
}

export interface FailedContentImageFallback extends ContentImageFallback {
  readonly outputUrl: string
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
  readonly #contentFallbacks = new Map<string, ContentImageFallback>()
  readonly #failedContentFallbacks = new Map<string, ContentImageFallback>()
  readonly #warnedContentFallbacks = new Set<string>()
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

  /** Associates authored content with a safe original-url fallback. */
  registerContentFallback(source: InternalImageSource, fallback: ContentImageFallback): void {
    if (this.#finalized) {
      throw new Error('@briansunter/nib-images: registry cannot register after finalization')
    }
    if (!this.#contentFallbacks.has(source.__nibSourceId)) {
      this.#contentFallbacks.set(source.__nibSourceId, fallback)
    }
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
      try {
        const cached = await executor.cachedFile(this.options.cacheDirectory, request)
        if (cached.hit) this.#stats.cacheHits += 1
        else this.#stats.coldTransforms += 1
        this.#stats.bytesWritten += cached.bytes
        await linkOrCopy(cached.file, path.join(clientDirectory, 'assets/nib', request.filename))
      } catch (error) {
        const fallback = this.#contentFallbacks.get(request.source.__nibSourceId)
        if (fallback === undefined) throw error
        this.#failedContentFallbacks.set(request.key, fallback)
        if (!this.#warnedContentFallbacks.has(request.source.__nibSourceId)) {
          this.#warnedContentFallbacks.add(request.source.__nibSourceId)
          const detail = error instanceof Error ? error.message : String(error)
          console.warn(`nib-images: preserving ${fallback.publicUrl} after transform failure: ${detail}`)
        }
      }
    })
    if (this.#requests.size > 0) {
      const elapsed = Math.round(performance.now() - started)
      console.info(
        `nib-images: ${this.#stats.coldTransforms} transformed, ${this.#stats.cacheHits} cached, ${this.#stats.bytesWritten} bytes (${elapsed}ms)`,
      )
    }
  }

  failedContentImageFallbacks(): readonly FailedContentImageFallback[] {
    return [...this.#failedContentFallbacks].flatMap(([key, fallback]) => {
      const request = this.#requests.get(key)
      if (request === undefined) return []
      return [{
        ...fallback,
        outputUrl: `${this.base}assets/nib/${request.filename}`,
      }]
    })
  }
}
