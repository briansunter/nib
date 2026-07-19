import type { InternalImageSource } from './image-source'

export type ImageLayout = 'constrained' | 'fixed' | 'full'

export interface FixedImageCandidate {
  readonly width: number
  readonly density: number
}

export interface ImageCandidatePlan {
  readonly fixed: boolean
  readonly widths: readonly number[]
  readonly sizes: string | undefined
  readonly displayWidth: number
  readonly displayHeight: number
  readonly fixedCandidates: readonly FixedImageCandidate[] | undefined
}

export interface ImageCandidatePlanOptions {
  readonly source: InternalImageSource
  readonly layout: ImageLayout
  readonly width: number | undefined
  readonly maxWidth: number | undefined
  readonly widths: readonly number[] | undefined
  readonly densities: readonly number[] | undefined
  readonly defaultWidths: readonly number[]
  readonly sizes: string | undefined
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

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`@briansunter/nib-images: ${name} must be a positive integer`)
  }
  return value
}

function normalizedWidths(values: readonly number[], name: string): number[] {
  if (values.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error(`@briansunter/nib-images: ${name} must contain positive integers`)
  }
  return [...new Set(values)].sort((left, right) => left - right)
}

const allowedDensities = new Set([1, 1.5, 2, 3])

function normalizedDensities(values: readonly number[]): number[] {
  if (values.length === 0 || values.some((value) => !allowedDensities.has(value))) {
    throw new Error('@briansunter/nib-images: densities may contain only 1, 1.5, 2, and 3')
  }
  return [...new Set(values)].sort((left, right) => left - right)
}

/**
 * One source of truth for image layout dimensions and transform candidates.
 * `maxWidth` is a hard cap; `widths` remains a responsive ladder.
 */
export function planImageCandidates(options: ImageCandidatePlanOptions): ImageCandidatePlan {
  const requestedWidth = options.width === undefined
    ? undefined
    : positiveInteger(options.width, 'width')
  const requestedMaximum = options.maxWidth === undefined
    ? undefined
    : positiveInteger(options.maxWidth, 'maxWidth')
  const fixed = options.layout === 'fixed'
  if (fixed && requestedWidth === undefined) {
    throw new Error('@briansunter/nib-images: fixed images require width')
  }
  const naturalDisplayWidth = fixed
    ? requestedWidth!
    : options.layout === 'constrained'
      ? Math.min(options.source.width, requestedWidth ?? options.source.width)
      : options.source.width
  const displayWidth = fixed
    ? naturalDisplayWidth
    : Math.min(naturalDisplayWidth, requestedMaximum ?? naturalDisplayWidth)
  if (!fixed && requestedMaximum !== undefined && requestedMaximum < naturalDisplayWidth && options.layout === 'constrained') {
    throw new Error('@briansunter/nib-images: maxWidth cannot be smaller than a constrained image width')
  }
  const displayHeight = Math.max(1, Math.round(displayWidth * options.source.height / options.source.width))
  const fixedPlanCandidates = fixed
    ? fixedCandidates(options.source, requestedWidth!, normalizedDensities(options.densities ?? [1, 2]))
    : undefined
  const candidateMaximum = fixed
    ? undefined
    : options.layout === 'constrained'
      ? Math.min(options.source.width, naturalDisplayWidth * 2, requestedMaximum ?? Number.POSITIVE_INFINITY)
      : displayWidth
  const widths = fixed
    ? fixedPlanCandidates!.map((candidate) => candidate.width)
    : responsiveWidths(
        options.source,
        options.widths === undefined
          ? options.defaultWidths
          : normalizedWidths(options.widths, 'widths'),
        candidateMaximum!,
        [displayWidth],
      )
  if (widths.length === 0) {
    throw new Error('@briansunter/nib-images: no usable image candidates were generated')
  }
  return {
    fixed,
    widths,
    sizes: fixed ? undefined : options.sizes ?? defaultSizes(options.layout, displayWidth),
    displayWidth,
    displayHeight,
    fixedCandidates: fixedPlanCandidates,
  }
}
