import { validateEnhancementId } from './enhancement-paths'

export interface EnhanceOptions {
  /** Wait until the enhanced element approaches the viewport before loading. */
  readonly when?: 'visible'
}

export interface EnhancementAttributes {
  readonly 'data-nib-enhancement': string
  readonly 'data-nib-when'?: 'visible'
}

/**
 * Returns the framework-owned attributes that attach one client enhancement to
 * an existing static HTML element.
 *
 * `enhance('search')` maps to
 * `src/enhancements/search/index.client.ts`. Spread the result onto the
 * element that the matching client module should receive.
 */
export function enhance(
  name: string,
  options: EnhanceOptions = {},
): EnhancementAttributes {
  const id = validateEnhancementId(name)
  const { when } = options
  if (when !== undefined && when !== 'visible') {
    throw new Error(`Invalid enhancement timing for ${id}: ${String(when)}`)
  }
  return Object.freeze({
    'data-nib-enhancement': id,
    ...(when === undefined ? {} : { 'data-nib-when': when }),
  })
}
