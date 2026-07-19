import type { InternalImageSource } from './image-source'

export type ImageLayout = 'constrained' | 'fixed' | 'full'

export interface FixedImageCandidate {
  readonly width: number
  readonly density: number
}

const minimumWidthRatio = 1.1

function removeNearDuplicates(
  widths: readonly number[],
  required: ReadonlySet<number>,
): number[] {
  const result: number[] = []
  for (const width of widths) {
    const previous = result.at(-1)
    if (previous === undefined || width / previous >= minimumWidthRatio) {
      result.push(width)
    } else if (required.has(width) && !required.has(previous)) {
      result[result.length - 1] = width
    } else if (required.has(width)) {
      result.push(width)
    }
  }
  return result
}

export function responsiveWidths(
  source: InternalImageSource,
  widths: readonly number[],
  maximum: number,
  requiredWidths: readonly number[] = [maximum],
): number[] {
  const cappedMaximum = Math.min(source.width, maximum)
  const required = new Set(requiredWidths.map((width) => Math.min(width, cappedMaximum)))
  required.add(cappedMaximum)
  const candidates = [...new Set([...widths, ...required])]
    .filter((width) => width <= cappedMaximum && width > 0)
    .sort((left, right) => left - right)
  return removeNearDuplicates(candidates, required)
}

export function fixedCandidates(
  source: InternalImageSource,
  width: number,
  densities: readonly number[],
): FixedImageCandidate[] {
  const candidates = new Map<number, FixedImageCandidate>()
  for (const density of densities) {
    const candidateWidth = Math.min(source.width, Math.round(width * density))
    if (candidateWidth <= 0) continue
    candidates.set(candidateWidth, {
      width: candidateWidth,
      density: candidateWidth / width,
    })
  }
  return [...candidates.values()].sort((left, right) => left.width - right.width)
}

export function defaultSizes(layout: ImageLayout, width: number): string | undefined {
  if (layout === 'fixed') return undefined
  if (layout === 'full') return '100vw'
  return `(max-width: ${width}px) 100vw, ${width}px`
}
