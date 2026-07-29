import { createElement, useCallback, type CSSProperties, type ImgHTMLAttributes } from 'react'
import type { ImageLayout } from './candidates'
import {
  computeImage,
  imageOrientation,
  type ImageOptions,
  type ImageResult,
} from './image-builder'
import type {
  ImageFormat,
  ImageQualityFormat,
  ImageSource,
} from './image-source'
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

export function Image(props: ImageProps) {
  const registry = useImageRegistry()
  if (typeof props.alt !== 'string') {
    throw new Error('@briansunter/nib-images: <Image> alt must be a string')
  }
  if (props.priority === true && (props.loading !== undefined || props.fetchPriority !== undefined)) {
    throw new Error('@briansunter/nib-images: priority cannot be combined with loading or fetchPriority')
  }
  const result = computeImage(registry, props)
  const {
    alt,
    formats: _formats,
    quality: _quality,
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
    style: userStyle,
    ...attributes
  } = props
  const source = props.src
  const layout: ImageLayout = props.layout ?? 'constrained'
  const intrinsicStyle = {
    '--nib-image-source-width': `${source.width}px`,
    '--nib-image-source-height': `${source.height}px`,
    '--nib-image-source-aspect': String(source.width / source.height),
  } as CSSProperties
  const layoutStyle: CSSProperties = layout === 'full'
    ? { ...intrinsicStyle, width: '100%', height: 'auto', ...userStyle }
    : layout === 'constrained'
      ? { ...intrinsicStyle, maxWidth: '100%', height: 'auto', ...userStyle }
      : { ...intrinsicStyle, ...userStyle }

  const imageElement = createElement('img', {
    ...attributes,
    src: result.src,
    ...(result.srcSet === undefined ? {} : { srcSet: result.srcSet }),
    ...(result.sizes === undefined ? {} : { sizes: result.sizes }),
    alt,
    width: result.width,
    height: result.height,
    'data-nib-orientation': imageOrientation(source),
    loading: priority ? 'eager' : loading ?? 'lazy',
    decoding: 'async',
    ...(priority ? { fetchPriority: 'high' } : fetchPriority === undefined ? {} : { fetchPriority }),
    style: layoutStyle,
  })

  if (result.passthrough || result.sources.length === 0) return imageElement
  const sources = result.sources.map((entry) => createElement('source', {
    key: entry.type,
    type: entry.type,
    srcSet: entry.srcSet,
    ...(entry.sizes === undefined ? {} : { sizes: entry.sizes }),
  }))
  return createElement('picture', null, ...sources, imageElement)
}

/**
 * Resolve optimized image sources for manual rendering or serialization. Returns
 * a stable builder bound to the build registry (the nib equivalent of Astro's
 * getImage()), so it can be called freely inside loops/maps without violating
 * the rules of hooks. The returned {@link ImageResult} carries the fallback
 * `<img>` src/srcSet plus modern-format `<source>` entries — enough to render a
 * `<picture>` directly or to hand optimized URLs to client-side code.
 */
export function useImage(): (options: ImageOptions) => ImageResult {
  const registry = useImageRegistry()
  return useCallback(
    (options: ImageOptions) => computeImage(registry, options),
    [registry],
  )
}
