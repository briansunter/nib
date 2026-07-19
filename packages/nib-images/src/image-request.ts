import crypto from 'node:crypto'
import type { ImageFormat, InternalImageSource, SourceImageFormat } from './image-source'
import { IMAGE_PROCESSOR_ID } from './processor'

export interface ImageTransformRequest {
  readonly key: string
  readonly source: InternalImageSource
  readonly width: number
  readonly format: ImageFormat | SourceImageFormat
  readonly quality: number
  readonly passthrough: boolean
  readonly filename: string
}

export interface DevelopmentImageRequest {
  readonly sourceId: string
  readonly width: number
  readonly quality: number
  readonly format: ImageFormat | 'gif' | 'svg'
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function safeStem(stem: string): string {
  const safe = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return (safe || 'image').slice(0, 48)
}

function assetName(
  source: InternalImageSource,
  key: string,
  width: number,
  format: string,
  passthrough: boolean,
): string {
  const suffix = passthrough ? '' : `-${width}`
  return `${safeStem(source.__nibStem)}.${key.slice(0, 12)}${suffix}.${format}`
}

function transformKey(
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

export function createImageTransformRequest(
  source: InternalImageSource,
  width: number,
  format: ImageFormat | SourceImageFormat,
  quality: number,
  passthrough = false,
): ImageTransformRequest {
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
  const key = transformKey(source, width, format, quality, passthrough)
  return {
    key,
    source,
    width,
    format,
    quality,
    passthrough,
    filename: assetName(source, key, width, format, passthrough),
  }
}

export function developmentImageUrl(base: string, request: ImageTransformRequest): string {
  return `${base.replace(/\/$/, '')}/@nib-images/${request.source.__nibSourceId}/${request.width}-${request.quality}.${request.format}`
}

export function parseDevelopmentImageRequest(pathname: string): DevelopmentImageRequest | undefined {
  const marker = pathname.indexOf('/@nib-images/')
  if (marker === -1) return undefined
  const match = pathname.slice(marker).match(/^\/\@nib-images\/([a-f0-9]{24})\/(\d+)-(\d+)\.(avif|webp|jpeg|png|gif|svg)$/)
  if (!match) return undefined
  return {
    sourceId: match[1]!,
    width: Number(match[2]),
    quality: Number(match[3]),
    format: match[4]! as DevelopmentImageRequest['format'],
  }
}

export function imageContentType(format: ImageFormat | 'gif' | 'svg'): string {
  return format === 'svg' ? 'image/svg+xml' : `image/${format}`
}
