import type { InternalImageSource } from './image-source'

export type ImageLayout = 'constrained' | 'fixed' | 'full'

export function responsiveWidths(
  source: InternalImageSource,
  widths: readonly number[],
  maximum: number,
): number[] {
  const cappedMaximum = Math.min(source.width, maximum)
  return [...new Set([...widths, cappedMaximum])]
    .filter((width) => width <= cappedMaximum && width > 0)
    .sort((left, right) => left - right)
}

export function fixedWidths(
  source: InternalImageSource,
  width: number,
  densities: readonly number[],
): number[] {
  return [...new Set(densities.map((density) => Math.min(source.width, Math.round(width * density))))]
    .filter((candidate) => candidate > 0)
    .sort((left, right) => left - right)
}

export function defaultSizes(layout: ImageLayout, width: number): string | undefined {
  if (layout === 'fixed') return undefined
  if (layout === 'full') return '100vw'
  return `(max-width: ${width}px) 100vw, ${width}px`
}
