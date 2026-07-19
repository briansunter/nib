export type SourceImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'svg'
export type ImageFormat = Extract<SourceImageFormat, 'jpeg' | 'png' | 'webp' | 'avif'>
export type ImageQualityFormat = Exclude<ImageFormat, 'png'>

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
    && /^[a-f0-9]{24}$/.test(source.__nibSourceId ?? '')
    && typeof source.__nibStem === 'string'
    && source.__nibStem.length > 0
    && typeof source.width === 'number'
    && Number.isSafeInteger(source.width)
    && source.width > 0
    && typeof source.height === 'number'
    && Number.isSafeInteger(source.height)
    && source.height > 0
    && ['jpeg', 'png', 'webp', 'avif', 'gif', 'svg'].includes(source.format ?? '')
    && typeof source.hasAlpha === 'boolean'
    && typeof source.animated === 'boolean'
    && typeof source.fingerprint === 'string'
    && source.fingerprint.length > 0
}

/** @internal Test and generated-module helper. Do not use in application code. */
export function createImageSource(source: Omit<InternalImageSource, typeof imageSourceBrand>): ImageSource {
  const {
    __nibImage,
    __nibFile,
    __nibSourceId,
    __nibStem,
    ...publicSource
  } = source
  return Object.defineProperties(publicSource, {
    __nibImage: { value: __nibImage },
    __nibFile: { value: __nibFile },
    __nibSourceId: { value: __nibSourceId },
    __nibStem: { value: __nibStem },
  }) as unknown as ImageSource
}
