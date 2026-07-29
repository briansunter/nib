import {
  planImageCandidates,
  type ImageLayout,
} from './candidates'
import type { ImageBuildRegistry } from './image-registry'
import {
  isImageSource,
  type ImageFormat,
  type ImageQualityFormat,
  type ImageSource,
  type InternalImageSource,
} from './image-source'

/** Options shared by <Image> and useImage()/getImage(). Describes a single
 * responsive image; the registry turns each (width, format) into a URL. */
export interface ImageOptions {
  src: ImageSource
  layout?: ImageLayout
  width?: number
  /** Hard cap for emitted transform widths without changing responsive markup. */
  maxWidth?: number
  widths?: readonly number[]
  densities?: readonly (1 | 1.5 | 2 | 3)[]
  sizes?: string
  formats?: readonly ImageFormat[]
  quality?: number | Partial<Record<ImageQualityFormat, number>>
  unoptimized?: boolean
}

/** A modern-format <source> entry for an optimized <picture>. */
export interface ImageSourceVariant {
  readonly type: string
  readonly srcSet: string
  readonly sizes?: string
}

/** Everything needed to render an optimized <img>/<picture> or serialize its
 * sources for client-side use (e.g. a detail image swapped at runtime). */
export interface ImageResult {
  /** Fallback <img> src (largest fallback-width candidate, or first for fixed). */
  readonly src: string
  /** Fallback <img> srcSet (widths or densities). Omitted for pass-through. */
  readonly srcSet?: string
  readonly sizes?: string
  readonly width: number
  readonly height: number
  /** Modern-format <source> entries (avif/webp). Empty for pass-through. */
  readonly sources: readonly ImageSourceVariant[]
  /** True for svg/animated/unoptimized sources: emit a bare <img> with src only. */
  readonly passthrough: boolean
}

const supportedLayouts = new Set<ImageLayout>(['constrained', 'fixed', 'full'])

function isQualityFormat(value: string): value is ImageQualityFormat {
  return value === 'avif' || value === 'webp' || value === 'jpeg'
}

function isImageFormat(value: string): value is ImageFormat {
  return value === 'avif' || value === 'webp' || value === 'jpeg' || value === 'png'
}

export function requestedQuality(
  quality: ImageOptions['quality'],
  format: ImageFormat,
): number | undefined {
  if (format === 'png') return undefined
  const value = typeof quality === 'number' ? quality : quality?.[format]
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > 100)) {
    throw new Error(`@briansunter/nib-images: quality for ${format} must be an integer from 1 to 100`)
  }
  return value
}

export function validateQualityOption(quality: ImageOptions['quality']): void {
  if (quality === undefined) return
  if (typeof quality === 'number') {
    if (!Number.isSafeInteger(quality) || quality < 1 || quality > 100) {
      throw new Error('@briansunter/nib-images: quality must be an integer from 1 to 100')
    }
    return
  }
  if (quality === null || typeof quality !== 'object' || Array.isArray(quality)) {
    throw new Error('@briansunter/nib-images: quality must be a number or format map')
  }
  for (const format of Object.keys(quality)) {
    if (!isQualityFormat(format)) {
      throw new Error(`@briansunter/nib-images: quality does not support ${format}`)
    }
    requestedQuality(quality, format)
  }
}

export function imageOrientation(source: ImageSource): 'landscape' | 'portrait' | 'square' {
  if (source.width > source.height) return 'landscape'
  if (source.width < source.height) return 'portrait'
  return 'square'
}

interface CandidateUrl {
  readonly url: string
  readonly width: number
  readonly density?: number
}

function formatDensity(value: number): string {
  return Number(value.toFixed(3)).toString()
}

function buildSrcSet(entries: readonly CandidateUrl[], fixed: boolean): string {
  return entries
    .map(({ url, width, density }) => `${url} ${fixed ? `${formatDensity(density!)}x` : `${width}w`}`)
    .join(', ')
}

/** Plans candidates and registers transforms, returning the resolved URLs and
 * layout dimensions. This is the single source of truth shared by <Image> and
 * useImage(); the only difference is how the caller renders the result. */
export function computeImage(
  registry: ImageBuildRegistry,
  options: ImageOptions,
): ImageResult {
  if (!isImageSource(options.src)) {
    throw new Error('@briansunter/nib-images: image src must come from a ?nib-image import')
  }
  const source: InternalImageSource = options.src
  const layout: ImageLayout = options.layout ?? 'constrained'
  if (!supportedLayouts.has(layout)) {
    throw new Error('@briansunter/nib-images: unsupported layout')
  }
  validateQualityOption(options.quality)
  const defaults = registry.defaults()
  const plan = planImageCandidates({
    source,
    layout,
    width: options.width,
    maxWidth: options.maxWidth,
    widths: options.widths,
    densities: options.densities,
    defaultWidths: defaults.widths,
    sizes: options.sizes,
  })
  const { fixed, widths, sizes, fixedCandidates } = plan
  const fallback: ImageFormat = source.hasAlpha ? 'png' : 'jpeg'
  const passthrough = Boolean(options.unoptimized || source.animated || source.format === 'svg')
  const formats = passthrough
    ? []
    : [...new Set(options.formats ?? defaults.formats)]
  if (formats.some((format) => !isImageFormat(format))) {
    throw new Error('@briansunter/nib-images: unsupported output format')
  }

  if (passthrough) {
    const url = registry.register(source, source.width, source.format, 100, true)
    return {
      src: url,
      width: plan.displayWidth,
      height: plan.displayHeight,
      sources: [],
      passthrough: true,
    }
  }

  const candidateUrls = (format: ImageFormat): CandidateUrl[] => widths.map((width) => ({
    width,
    ...(fixed
      ? { density: fixedCandidates!.find((candidate) => candidate.width === width)!.density }
      : {}),
    url: registry.register(
      source,
      width,
      format,
      requestedQuality(options.quality, format) ?? defaults.quality[format],
      false,
    ),
  }))

  const fallbackCandidates = candidateUrls(fallback)
  const src = fixed ? fallbackCandidates[0]!.url : fallbackCandidates.at(-1)!.url
  const sources: ImageSourceVariant[] = formats
    .filter((format) => format !== fallback)
    .map((format) => {
      const candidates = candidateUrls(format)
      return {
        type: `image/${format === 'jpeg' ? 'jpeg' : format}`,
        srcSet: buildSrcSet(candidates, fixed),
        ...(sizes === undefined ? {} : { sizes }),
      }
    })
  return {
    src,
    srcSet: buildSrcSet(fallbackCandidates, fixed),
    ...(sizes === undefined ? {} : { sizes }),
    width: plan.displayWidth,
    height: plan.displayHeight,
    sources,
    passthrough: false,
  }
}
