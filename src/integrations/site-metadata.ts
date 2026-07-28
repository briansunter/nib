import type { NibPlugin } from '../framework/plugin'
import type { HeadContribution } from '../framework/types'

export interface SiteMetadataOptions {
  /** Site title used for the home page. */
  readonly title: string
  /** Description used only when a page does not provide one. */
  readonly description?: string
  /** Non-home title template. Must contain one "%s" page-title placeholder. */
  readonly titleTemplate?: string
  /** Shared structured elements appended to every document head. */
  readonly head?: Readonly<Pick<HeadContribution, 'elements'>>
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Nib site metadata ${label} must be a non-empty string`)
  }
  return value
}

/**
 * Adds optional site-wide title, description, and structured-head policy.
 *
 * Pages remain authoritative: every page still supplies its own title, and a
 * page description wins over the site fallback.
 */
export function siteMetadata(options: SiteMetadataOptions): NibPlugin {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Nib site metadata requires an options object')
  }
  const title = requiredText(options.title, 'title')
  if (options.description !== undefined && typeof options.description !== 'string') {
    throw new Error('Nib site metadata description must be a string')
  }
  if (options.titleTemplate !== undefined) {
    requiredText(options.titleTemplate, 'titleTemplate')
    if (
      !options.titleTemplate.includes('%s')
      || options.titleTemplate.indexOf('%s') !== options.titleTemplate.lastIndexOf('%s')
    ) {
      throw new Error('Nib site metadata titleTemplate must contain exactly one "%s" placeholder')
    }
  }
  if (
    options.head !== undefined
    && (
      options.head === null
      || typeof options.head !== 'object'
      || Array.isArray(options.head)
      || Object.keys(options.head).some((field) => field !== 'elements')
    )
  ) {
    throw new Error('Nib site metadata head may define only structured elements')
  }

  return {
    name: '@briansunter/nib-site-metadata',
    renderer() {
      return {
        head({ route }) {
          const pageTitle = route.path === '/'
            ? title
            : options.titleTemplate?.replace('%s', route.meta.title) ?? route.meta.title
          return {
            title: pageTitle,
            ...(route.meta.description === undefined && options.description !== undefined
              ? { description: options.description }
              : {}),
            ...(options.head?.elements === undefined
              ? {}
              : { elements: options.head.elements }),
          }
        },
      }
    },
  }
}
