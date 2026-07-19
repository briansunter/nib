export type SourceImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'svg'
export type ImageFormat = Extract<SourceImageFormat, 'jpeg' | 'png' | 'webp' | 'avif'>

declare const imageSourceBrand: unique symbol

/** Metadata emitted only by the `?nib-image` Vite import transform. */
export interface ImageSource {
  readonly [imageSourceBrand]: true
  readonly width: number
  readonly height: number
  readonly format: SourceImageFormat
  readonly hasAlpha: boolean
  readonly animated: boolean
  readonly fingerprint: string
}

export interface InternalImageSource extends ImageSource {
  readonly __nibImage: true
  readonly __nibFile: string
  readonly __nibSourceId: string
  readonly __nibStem: string
}

export function isImageSource(value: unknown): value is InternalImageSource {
  if (value === null || typeof value !== 'object') return false
  const source = value as Partial<InternalImageSource>
  return source.__nibImage === true
    && typeof source.__nibFile === 'string'
    && typeof source.__nibSourceId === 'string'
    && typeof source.__nibStem === 'string'
    && typeof source.width === 'number'
    && Number.isSafeInteger(source.width)
    && source.width > 0
    && typeof source.height === 'number'
    && Number.isSafeInteger(source.height)
    && source.height > 0
    && typeof source.fingerprint === 'string'
}

/** @internal Test and generated-module helper. Do not use in application code. */
export function createImageSource(source: Omit<InternalImageSource, typeof imageSourceBrand>): ImageSource {
  return source as unknown as ImageSource
}
