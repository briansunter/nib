import { createElement, type CSSProperties, type ImgHTMLAttributes } from 'react'
import {
  defaultSizes,
  fixedCandidates,
  responsiveWidths,
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
  widths?: readonly number[]
  sizes?: string
  densities?: never
}

interface FixedImageLayout {
  layout: 'fixed'
  width: number
  densities?: readonly (1 | 1.5 | 2 | 3)[]
  widths?: never
  sizes?: never
}

interface FullImageLayout {
  layout: 'full'
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

function positiveWidths(values: readonly number[], name: string): number[] {
  if (values.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error(`@briansunter/nib-images: ${name} must contain positive integers`)
  }
  return [...new Set(values)].sort((left, right) => left - right)
}

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

function positiveWidth(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`@briansunter/nib-images: ${name} must be a positive integer`)
  }
  return value
}

const allowedDensities = new Set([1, 1.5, 2, 3])

function positiveDensities(values: readonly number[]): number[] {
  if (
    values.length === 0
    || values.some((value) => !allowedDensities.has(value))
  ) {
    throw new Error('@briansunter/nib-images: densities may contain only 1, 1.5, 2, and 3')
  }
  return [...new Set(values)].sort((left, right) => left - right)
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

function displayDimensions(
  source: InternalImageSource,
  layout: ImageLayout,
  maximum: number,
  requestedWidth: number | undefined,
): { width: number; height: number } {
  const width = layout === 'fixed' ? requestedWidth! : layout === 'constrained' ? maximum : source.width
  return {
    width,
    height: Math.max(1, Math.round(width * source.height / source.width)),
  }
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
  const requestedWidth = props.width === undefined
    ? undefined
    : positiveWidth(props.width, 'width')
  const maximum = layout === 'full'
    ? source.width
    : Math.min(source.width, requestedWidth ?? source.width)
  const fixed = layout === 'fixed'
  const fixedImageCandidates = fixed
    ? fixedCandidates(source, requestedWidth!, positiveDensities(props.densities ?? [1, 2]))
    : undefined
  const widths = fixed
    ? fixedImageCandidates!.map((candidate) => candidate.width)
    : responsiveWidths(
        source,
        props.widths === undefined ? defaults.widths : positiveWidths(props.widths, 'widths'),
        maximum * (layout === 'constrained' ? 2 : 1),
        [maximum],
      )
  if (widths.length === 0) {
    throw new Error('@briansunter/nib-images: no usable image candidates were generated')
  }
  const sizes = fixed ? undefined : props.sizes ?? defaultSizes(layout, maximum)
  const dimensions = displayDimensions(source, layout, maximum, requestedWidth)
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
      width: dimensions.width,
      height: dimensions.height,
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
    width: dimensions.width,
    height: dimensions.height,
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
