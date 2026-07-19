import { cachedBuffer, cachedFile } from './cache'
import { createTaskQueue } from './concurrency'
import type { ImageTransformRequest } from './image-request'
import { sourcePipeline, transformFromPipeline, transformImage } from './processor'

export interface ImageTransformExecutorOptions {
  readonly concurrency: number
  readonly reuseSourcePipelines?: boolean
  readonly onActive?: (active: number) => void
}

/** Shares cache identity and bounded CPU work while allowing each adapter to
 * choose whether a long-lived source pipeline is worthwhile. */
export class ImageTransformExecutor {
  readonly #transform: ReturnType<typeof createTaskQueue>
  readonly #pipelines = new Map<string, ReturnType<typeof sourcePipeline>>()
  readonly #reuseSourcePipelines: boolean

  constructor(options: ImageTransformExecutorOptions) {
    this.#transform = createTaskQueue(options.concurrency, options.onActive)
    this.#reuseSourcePipelines = options.reuseSourcePipelines ?? false
  }

  async cachedFile(cacheDirectory: string, request: ImageTransformRequest) {
    return cachedFile(cacheDirectory, request.key, request.format, () => this.#render(request))
  }

  async cachedBuffer(cacheDirectory: string, request: ImageTransformRequest) {
    return cachedBuffer(cacheDirectory, request.key, request.format, () => this.#render(request))
  }

  async #render(request: ImageTransformRequest): Promise<Buffer> {
    return this.#transform(async () => {
      if (request.passthrough || !this.#reuseSourcePipelines) {
        return transformImage(
          request.source,
          request.width,
          request.format,
          request.quality,
          request.passthrough,
        )
      }
      let pipeline = this.#pipelines.get(request.source.fingerprint)
      if (pipeline === undefined) {
        pipeline = sourcePipeline(request.source)
        this.#pipelines.set(request.source.fingerprint, pipeline)
      }
      return transformFromPipeline(
        pipeline.clone(),
        request.width,
        request.format as 'avif' | 'webp' | 'jpeg' | 'png',
        request.quality,
      )
    })
  }
}
