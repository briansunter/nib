import os from 'node:os'
import path from 'node:path'
import type { ImageFormat } from './image-source'

export interface ImagesOptions {
  readonly formats?: readonly Exclude<ImageFormat, 'jpeg' | 'png'>[]
  readonly widths?: readonly number[]
  readonly quality?: number | Partial<Record<ImageFormat, number>>
  readonly cacheDirectory?: string
  readonly concurrency?: 'auto' | number
  readonly memoryLimitMb?: number
  readonly allowedSourceRoots?: readonly string[]
}

export interface NormalizedImagesOptions {
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
    for (const format of Object.keys(result) as ImageFormat[]) result[format] = quality
  } else if (quality !== undefined) {
    Object.assign(result, quality)
  }
  for (const [format, value] of Object.entries(result)) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
      throw new Error(`@briansunter/nib-images: quality for ${format} must be an integer from 1 to 100`)
    }
  }
  return result
}

export function normalizeImagesOptions(root: string, options: ImagesOptions = {}): NormalizedImagesOptions {
  const formats = [...new Set<'avif' | 'webp'>(options.formats ?? ['avif', 'webp'])]
  if (formats.length === 0 || formats.some((format) => format !== 'avif' && format !== 'webp')) {
    throw new Error('@briansunter/nib-images: formats may contain only avif and webp')
  }
  const concurrency = options.concurrency === undefined || options.concurrency === 'auto'
    ? Math.max(1, Math.min(os.availableParallelism(), 4))
    : options.concurrency
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
    throw new Error('@briansunter/nib-images: concurrency must be a positive integer or "auto"')
  }
  if (options.memoryLimitMb !== undefined && (!Number.isFinite(options.memoryLimitMb) || options.memoryLimitMb <= 0)) {
    throw new Error('@briansunter/nib-images: memoryLimitMb must be positive')
  }
  return {
    formats,
    widths: normalizedPositiveIntegers(options.widths ?? defaultWidths, 'widths'),
    quality: normalizedQuality(options.quality),
    cacheDirectory: path.resolve(root, options.cacheDirectory ?? '.nib/cache/images'),
    concurrency: options.memoryLimitMb === undefined
      ? concurrency
      : Math.max(1, Math.min(concurrency, Math.floor(options.memoryLimitMb / 64))),
    allowedSourceRoots: (options.allowedSourceRoots ?? [root]).map((directory) => path.resolve(root, directory)),
  }
}

export function isAllowedSource(file: string, roots: readonly string[]): boolean {
  return roots.some((root) => file === root || file.startsWith(`${root}${path.sep}`))
}
