import { createElement, type CSSProperties, type ImgHTMLAttributes } from 'react'
import { defaultSizes, fixedWidths, responsiveWidths, type ImageLayout } from './candidates'
import type { ImageFormat, ImageSource, InternalImageSource } from './image-source'
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
  quality?: number | Partial<Record<ImageFormat, number>>
  placeholder?: 'none' | 'dominant-color'
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
  const value = typeof quality === 'number' ? quality : quality?.[format]
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > 100)) {
    throw new Error(`@briansunter/nib-images: quality for ${format} must be an integer from 1 to 100`)
  }
  return value
}

function srcSet(entries: Array<{ url: string; width: number }>, fixed: boolean): string {
  return entries.map(({ url, width }, index) => `${url} ${fixed ? [1, 1.5, 2, 3][index] ?? 1 : width}w`).join(', ')
}

export function Image(props: ImageProps) {
  const registry = useImageRegistry()
  if (!isImageSource(props.src)) {
    throw new Error('@briansunter/nib-images: <Image> src must come from a ?nib-image import')
  }
  const source = props.src as InternalImageSource
  const defaults = registry.defaults()
  const layout: ImageLayout = props.layout ?? 'constrained'
  const maximum = layout === 'full' ? source.width : Math.min(source.width, props.width ?? source.width)
  const fixedWidth = layout === 'fixed' ? props.width : undefined
  const widths = layout === 'fixed'
    ? fixedWidths(source, fixedWidth!, props.densities ?? [1, 2])
    : responsiveWidths(source, props.widths === undefined ? defaults.widths : positiveWidths(props.widths, 'widths'), maximum * (layout === 'constrained' ? 2 : 1))
  const fixed = layout === 'fixed'
  const sizes = fixed ? undefined : props.sizes ?? defaultSizes(layout, maximum)
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
    placeholder: _placeholder,
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
    url: registry.register(source, width, format, requestedQuality(quality, format) ?? defaults.quality[format], passthrough),
  }))
  if (passthrough) {
    const url = registry.register(source, source.width, source.format, 100, true)
    return createElement('img', {
      ...attributes,
      src: url,
      alt,
      width: source.width,
      height: source.height,
      loading: priority ? 'eager' : loading ?? 'lazy',
      decoding: 'async',
      ...(priority ? { fetchPriority: 'high' } : fetchPriority === undefined ? {} : { fetchPriority }),
      style: layoutStyle,
    })
  }
  const fallbackCandidates = candidateUrls(fallback)
  const fallbackUrl = fallbackCandidates.at(-1)!.url
  const image = createElement('img', {
    ...attributes,
    src: fallbackUrl,
    srcSet: srcSet(fallbackCandidates, fixed),
    ...(sizes === undefined ? {} : { sizes }),
    alt,
    width: source.width,
    height: source.height,
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
