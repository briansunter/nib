import { createElement, type CSSProperties, type ImgHTMLAttributes } from 'react'
import {
  planImageCandidates,
  type ImageLayout,
} from './candidates'
import type {
  ImageFormat,
  ImageQualityFormat,
  ImageSource,
  InternalImageSource,
} from './image-source'
import { isImageSource } from './image-source'
import { useImageRegistry } from './image-context'

type ImageEventProp = Extract<keyof ImgHTMLAttributes<HTMLImageElement>, `on${string}`>
type ImageCommonProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  | ImageEventProp
  | 'alt'
  | 'children'
  | 'dangerouslySetInnerHTML'
  | 'src'
  | 'srcSet'
  | 'width'
  | 'height'
  | 'sizes'
  | 'loading'
  | 'decoding'
  | 'fetchPriority'
>

interface CommonProps extends ImageCommonProps {
  src: ImageSource
  alt: string
  formats?: readonly ImageFormat[]
  quality?: number | Partial<Record<ImageQualityFormat, number>>
  unoptimized?: boolean
}

interface ConstrainedImageLayout {
  layout?: 'constrained'
  width?: number
  /** Hard cap for emitted transform widths without changing responsive markup. */
  maxWidth?: number
  widths?: readonly number[]
  sizes?: string
  densities?: never
}

interface FixedImageLayout {
  layout: 'fixed'
  width: number
  densities?: readonly (1 | 1.5 | 2 | 3)[]
  widths?: never
  maxWidth?: never
  sizes?: never
}

interface FullImageLayout {
  layout: 'full'
  /** Hard cap for emitted transform widths and intrinsic layout dimensions. */
  maxWidth?: number
  widths?: readonly number[]
  sizes?: string
  width?: never
  densities?: never
}

type PriorityImage = { priority: true; loading?: never; fetchPriority?: never }
type DeferredImage = {
  priority?: false
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'low' | 'auto'
}

export type ImageProps = CommonProps
  & (ConstrainedImageLayout | FixedImageLayout | FullImageLayout)
  & (PriorityImage | DeferredImage)

const supportedLayouts = new Set<ImageLayout>(['constrained', 'fixed', 'full'])
const qualityFormats = new Set<ImageQualityFormat>(['avif', 'webp', 'jpeg'])

function requestedQuality(
  quality: ImageProps['quality'],
  format: ImageFormat,
): number | undefined {
  if (format === 'png') return undefined
  const value = typeof quality === 'number' ? quality : quality?.[format]
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > 100)) {
    throw new Error(`@briansunter/nib-images: quality for ${format} must be an integer from 1 to 100`)
  }
  return value
}

function validateQualityOption(quality: ImageProps['quality']): void {
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
    if (!qualityFormats.has(format as ImageQualityFormat)) {
      throw new Error(`@briansunter/nib-images: quality does not support ${format}`)
    }
    requestedQuality(quality, format as ImageQualityFormat)
  }
}

interface CandidateUrl {
  readonly url: string
  readonly width: number
  readonly density?: number
}

function formatDensity(value: number): string {
  return Number(value.toFixed(3)).toString()
}

function srcSet(entries: readonly CandidateUrl[], fixed: boolean): string {
  return entries
    .map(({ url, width, density }) => `${url} ${fixed ? `${formatDensity(density!)}x` : `${width}w`}`)
    .join(', ')
}

export function Image(props: ImageProps) {
  const registry = useImageRegistry()
  if (!isImageSource(props.src)) {
    throw new Error('@briansunter/nib-images: <Image> src must come from a ?nib-image import')
  }
  const source = props.src as InternalImageSource
  if (typeof props.alt !== 'string') {
    throw new Error('@briansunter/nib-images: <Image> alt must be a string')
  }
  if (!supportedLayouts.has(props.layout ?? 'constrained')) {
    throw new Error('@briansunter/nib-images: unsupported layout')
  }
  if (props.priority === true && (props.loading !== undefined || props.fetchPriority !== undefined)) {
    throw new Error('@briansunter/nib-images: priority cannot be combined with loading or fetchPriority')
  }
  validateQualityOption(props.quality)
  const defaults = registry.defaults()
  const layout: ImageLayout = props.layout ?? 'constrained'
  const plan = planImageCandidates({
    source,
    layout,
    width: props.width,
    maxWidth: props.maxWidth,
    widths: props.widths,
    densities: props.densities,
    defaultWidths: defaults.widths,
    sizes: props.sizes,
  })
  const { fixed, widths, sizes, fixedCandidates: fixedImageCandidates } = plan
  const fallback: ImageFormat = source.hasAlpha ? 'png' : 'jpeg'
  const formats = source.animated || source.format === 'svg' || props.unoptimized
    ? []
    : [...new Set(props.formats ?? defaults.formats)]
  if (formats.some((format) => !['avif', 'webp', 'jpeg', 'png'].includes(format))) {
    throw new Error('@briansunter/nib-images: unsupported output format')
  }
  const userStyle = props.style
  const layoutStyle: CSSProperties = layout === 'full'
    ? { width: '100%', height: 'auto', ...userStyle }
    : layout === 'constrained'
      ? { maxWidth: '100%', height: 'auto', ...userStyle }
      : userStyle ?? {}
  const {
    src: _src,
    alt,
    formats: _formats,
    quality,
    unoptimized,
    layout: _layout,
    widths: _widths,
    densities: _densities,
    priority,
    loading,
    fetchPriority,
    width: _width,
    maxWidth: _maxWidth,
    sizes: _sizes,
    style: _style,
    ...attributes
  } = props
  const passthrough = Boolean(unoptimized || source.animated || source.format === 'svg')
  const candidateUrls = (format: ImageFormat) => widths.map((width) => ({
    width,
    ...(fixed
      ? { density: fixedImageCandidates!.find((candidate) => candidate.width === width)!.density }
      : {}),
    url: registry.register(source, width, format, requestedQuality(quality, format) ?? defaults.quality[format], passthrough),
  }))
  if (passthrough) {
    const url = registry.register(source, source.width, source.format, 100, true)
    return createElement('img', {
      ...attributes,
      src: url,
      alt,
      width: plan.displayWidth,
      height: plan.displayHeight,
      loading: priority ? 'eager' : loading ?? 'lazy',
      decoding: 'async',
      ...(priority ? { fetchPriority: 'high' } : fetchPriority === undefined ? {} : { fetchPriority }),
      style: layoutStyle,
    })
  }
  const fallbackCandidates = candidateUrls(fallback)
  const fallbackUrl = fixed ? fallbackCandidates[0]!.url : fallbackCandidates.at(-1)!.url
  const image = createElement('img', {
    ...attributes,
    src: fallbackUrl,
    srcSet: srcSet(fallbackCandidates, fixed),
    ...(sizes === undefined ? {} : { sizes }),
    alt,
    width: plan.displayWidth,
    height: plan.displayHeight,
    loading: priority ? 'eager' : loading ?? 'lazy',
    decoding: 'async',
    ...(priority ? { fetchPriority: 'high' } : fetchPriority === undefined ? {} : { fetchPriority }),
    style: layoutStyle,
  })
  const sources = formats.filter((format) => format !== fallback).map((format) => {
    const candidates = candidateUrls(format)
    return createElement('source', {
      key: format,
      type: `image/${format === 'jpeg' ? 'jpeg' : format}`,
      srcSet: srcSet(candidates, fixed),
      ...(sizes === undefined ? {} : { sizes }),
    })
  })
  return createElement('picture', null, ...sources, image)
}
