import os from 'node:os'
import path from 'node:path'
import type { ImageFormat, ImageQualityFormat } from './image-source'

export interface ImagesOptions {
  readonly formats?: readonly Exclude<ImageFormat, 'jpeg' | 'png'>[]
  readonly widths?: readonly number[]
  readonly quality?: number | Partial<Record<ImageQualityFormat, number>>
  readonly cacheDirectory?: string
  readonly concurrency?: 'auto' | number
  readonly memoryLimitMb?: number
  readonly allowedSourceRoots?: readonly string[]
}

export interface NormalizedImagesOptions {
  /** Absolute Nib project root used to resolve Vite's project-relative ids. */
  readonly root: string
  readonly formats: readonly ('avif' | 'webp')[]
  readonly widths: readonly number[]
  readonly quality: Readonly<Record<ImageFormat, number>>
  readonly cacheDirectory: string
  readonly concurrency: number
  readonly allowedSourceRoots: readonly string[]
}

const defaultWidths = [320, 480, 640, 768, 1024, 1280, 1536, 1920, 2560]
const defaultQuality: Record<ImageFormat, number> = {
  avif: 50,
  webp: 75,
  jpeg: 80,
  png: 90,
}
const lossyFormats = ['avif', 'webp', 'jpeg'] as const

function libuvParallelism(): number {
  const configured = Number(process.env.UV_THREADPOOL_SIZE ?? 4)
  return Number.isSafeInteger(configured) && configured > 0 ? configured : 4
}

function normalizedPositiveIntegers(values: readonly number[], name: string): number[] {
  const normalized = [...new Set(values)].sort((left, right) => left - right)
  if (normalized.length === 0 || normalized.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error(`@briansunter/nib-images: ${name} must contain positive integers`)
  }
  return normalized
}

function normalizedQuality(quality: ImagesOptions['quality']): Record<ImageFormat, number> {
  const result = { ...defaultQuality }
  if (typeof quality === 'number') {
    for (const format of lossyFormats) result[format] = quality
  } else if (quality !== undefined) {
    if (quality === null || typeof quality !== 'object' || Array.isArray(quality)) {
      throw new Error('@briansunter/nib-images: quality must be a number or format map')
    }
    for (const [format, value] of Object.entries(quality)) {
      if (!lossyFormats.includes(format as ImageQualityFormat)) {
        throw new Error(`@briansunter/nib-images: quality does not support ${format}`)
      }
      result[format as ImageQualityFormat] = value
    }
  }
  for (const [format, value] of Object.entries(result)) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
      throw new Error(`@briansunter/nib-images: quality for ${format} must be an integer from 1 to 100`)
    }
  }
  return result
}

/** Validate user-controlled option values before a plugin is returned to Nib. */
export function validateImagesOptions(options: ImagesOptions = {}): void {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('@briansunter/nib-images: options must be an object')
  }
  if (options.formats !== undefined && !Array.isArray(options.formats)) {
    throw new Error('@briansunter/nib-images: formats must be an array')
  }
  if (options.widths !== undefined && !Array.isArray(options.widths)) {
    throw new Error('@briansunter/nib-images: widths must be an array')
  }
  if (
    options.allowedSourceRoots !== undefined
    && (
      !Array.isArray(options.allowedSourceRoots)
      || options.allowedSourceRoots.some((directory) => typeof directory !== 'string' || directory === '')
    )
  ) {
    throw new Error('@briansunter/nib-images: allowedSourceRoots must contain directory strings')
  }
  if (
    options.cacheDirectory !== undefined
    && (typeof options.cacheDirectory !== 'string' || options.cacheDirectory === '')
  ) {
    throw new Error('@briansunter/nib-images: cacheDirectory must be a non-empty string')
  }
  const formats = [...new Set<'avif' | 'webp'>(options.formats ?? ['avif', 'webp'])]
  if (formats.length === 0 || formats.some((format) => format !== 'avif' && format !== 'webp')) {
    throw new Error('@briansunter/nib-images: formats may contain only avif and webp')
  }
  normalizedPositiveIntegers(options.widths ?? defaultWidths, 'widths')
  normalizedQuality(options.quality)
  const concurrency = options.concurrency === undefined || options.concurrency === 'auto'
    ? Math.max(1, Math.min(os.availableParallelism(), libuvParallelism()))
    : options.concurrency
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
    throw new Error('@briansunter/nib-images: concurrency must be a positive integer or "auto"')
  }
  if (options.memoryLimitMb !== undefined && (!Number.isFinite(options.memoryLimitMb) || options.memoryLimitMb <= 0)) {
    throw new Error('@briansunter/nib-images: memoryLimitMb must be positive')
  }
}

export function normalizeImagesOptions(root: string, options: ImagesOptions = {}): NormalizedImagesOptions {
  validateImagesOptions(options)
  const resolvedRoot = path.resolve(root)
  const formats = [...new Set<'avif' | 'webp'>(options.formats ?? ['avif', 'webp'])]
  const concurrency = options.concurrency === undefined || options.concurrency === 'auto'
    ? Math.max(1, Math.min(os.availableParallelism(), libuvParallelism()))
    : options.concurrency
  return {
    root: resolvedRoot,
    formats,
    widths: normalizedPositiveIntegers(options.widths ?? defaultWidths, 'widths'),
    quality: normalizedQuality(options.quality),
    cacheDirectory: path.resolve(resolvedRoot, options.cacheDirectory ?? '.nib/cache/images'),
    concurrency: options.memoryLimitMb === undefined
      ? concurrency
      : Math.max(1, Math.min(concurrency, Math.floor(options.memoryLimitMb / 192))),
    allowedSourceRoots: (options.allowedSourceRoots ?? [resolvedRoot]).map((directory) => path.resolve(resolvedRoot, directory)),
  }
}

export function isAllowedSource(file: string, roots: readonly string[]): boolean {
  return roots.some((root) => file === root || file.startsWith(`${root}${path.sep}`))
}
