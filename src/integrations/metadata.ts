import { deployedOrigin, deployedRouteUrl } from '../framework/deployed-url'
import { metadataImageSrc, normalizeMetadataImage } from '../framework/meta'
import type { NibPlugin, NibRenderPageContext } from '../framework/plugin'
import type {
  HeadAttributeValue,
  HeadContribution,
  HeadElement,
  MetadataImage,
} from '../framework/types'

export interface MetadataResolveResult {
  /** A deployed route or absolute URL used for social previews. */
  readonly image?: MetadataImage
  readonly type?: 'website' | 'article'
  readonly twitterCard?: 'summary' | 'summary_large_image'
}

export interface MetadataOptions extends MetadataResolveResult {
  readonly siteName?: string
  /** Twitter/X account for the site, including the leading `@`. */
  readonly twitterSite?: string
  readonly structuredData?: boolean
  /** Computes route-specific social defaults before route metadata is applied. */
  readonly resolve?: (context: NibRenderPageContext) => MetadataResolveResult | void
}

interface NormalizedMetadataOptions extends MetadataOptions {
  readonly type: 'website' | 'article'
  readonly twitterCard: 'summary' | 'summary_large_image'
  readonly structuredData: boolean
}

function metadataType(value: unknown, label: string): 'website' | 'article' | undefined {
  if (value === undefined) return undefined
  if (value !== 'website' && value !== 'article') {
    throw new Error(`${label} must be website or article`)
  }
  return value
}

function metadataTwitterCard(
  value: unknown,
  label: string,
): 'summary' | 'summary_large_image' | undefined {
  if (value === undefined) return undefined
  if (value !== 'summary' && value !== 'summary_large_image') {
    throw new Error(`${label} must be summary or summary_large_image`)
  }
  return value
}

function resolvedMetadata(
  context: NibRenderPageContext,
  options: NormalizedMetadataOptions,
): MetadataResolveResult {
  const resolved = options.resolve?.(context)
  if (
    resolved !== undefined
    && (resolved === null || typeof resolved !== 'object' || Array.isArray(resolved))
  ) {
    throw new Error('Nib metadata resolve() must return an object or undefined')
  }
  const values = resolved ?? {}
  const image = normalizeMetadataImage(values.image, 'Nib metadata resolve() image')
  const type = metadataType(values.type, 'Nib metadata resolve() type')
  const twitterCard = metadataTwitterCard(
    values.twitterCard,
    'Nib metadata resolve() twitterCard',
  )
  return {
    ...(image === undefined ? {} : { image }),
    ...(type === undefined ? {} : { type }),
    ...(twitterCard === undefined ? {} : { twitterCard }),
  }
}

function absoluteUrl(value: string, context: NibRenderPageContext): string {
  if (/^https?:\/\//i.test(value)) return value
  const origin = deployedOrigin(context.origin, undefined, 'Nib metadata')
  return deployedRouteUrl(origin, context.base, value)
}

function contribution(
  context: NibRenderPageContext,
  options: NormalizedMetadataOptions,
): HeadContribution {
  const routeMeta = context.route.meta
  const resolved = resolvedMetadata(context, options)
  // Each social field falls back independently: route metadata wins over the
  // resolver, which wins over the static plugin default.
  const type = routeMeta.type ?? resolved.type ?? options.type
  const twitterCard = routeMeta.twitterCard ?? resolved.twitterCard ?? options.twitterCard
  const routeImage = normalizeMetadataImage(routeMeta.image, 'Page metadata image')
  const image = routeImage ?? resolved.image ?? options.image
  const elements: HeadElement[] = []
  let url: string | undefined
  if (context.origin !== undefined) {
    url = deployedRouteUrl(
      deployedOrigin(context.origin, undefined, 'Nib metadata'),
      context.base,
      context.route.path,
    )
    elements.push({ key: 'canonical', tag: 'link', attributes: { rel: 'canonical', href: url } })
  }
  const addMeta = (attributes: Record<string, HeadAttributeValue>, key: string) => {
    elements.push({ key, tag: 'meta', attributes })
  }
  addMeta({ property: 'og:title', content: context.route.meta.title }, 'og:title')
  if (context.route.meta.description !== undefined) {
    addMeta({ property: 'og:description', content: context.route.meta.description }, 'og:description')
  }
  addMeta({ property: 'og:type', content: type }, 'og:type')
  if (url !== undefined) addMeta({ property: 'og:url', content: url }, 'og:url')
  if (options.siteName !== undefined) addMeta({ property: 'og:site_name', content: options.siteName }, 'og:site_name')
  addMeta({ name: 'twitter:card', content: twitterCard }, 'twitter:card')
  if (options.twitterSite !== undefined) {
    addMeta({ name: 'twitter:site', content: options.twitterSite }, 'twitter:site')
  }
  addMeta({ name: 'twitter:title', content: context.route.meta.title }, 'twitter:title')
  if (context.route.meta.description !== undefined) {
    addMeta({ name: 'twitter:description', content: context.route.meta.description }, 'twitter:description')
  }
  const imageSrc = metadataImageSrc(image)
  if (imageSrc !== undefined) {
    addMeta({ property: 'og:image', content: absoluteUrl(imageSrc, context) }, 'og:image')
    addMeta({ name: 'twitter:image', content: absoluteUrl(imageSrc, context) }, 'twitter:image')
    if (typeof image === 'object') {
      if (image.alt !== undefined) {
        addMeta({ property: 'og:image:alt', content: image.alt }, 'og:image:alt')
        addMeta({ name: 'twitter:image:alt', content: image.alt }, 'twitter:image:alt')
      }
      if (image.width !== undefined) {
        addMeta({ property: 'og:image:width', content: image.width }, 'og:image:width')
      }
      if (image.height !== undefined) {
        addMeta({ property: 'og:image:height', content: image.height }, 'og:image:height')
      }
      if (image.type !== undefined) {
        addMeta({ property: 'og:image:type', content: image.type }, 'og:image:type')
      }
    }
  }
  if (options.structuredData && url !== undefined) {
    elements.push({
      key: 'structured-data',
      tag: 'script',
      attributes: { type: 'application/ld+json' },
      content: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': type === 'article' ? 'Article' : 'WebPage',
        name: context.route.meta.title,
        ...(context.route.meta.description === undefined
          ? {}
          : { description: context.route.meta.description }),
        url,
      }),
    })
  }
  return { elements }
}

/** Adds canonical, Open Graph, Twitter, and optional WebPage metadata. */
export function metadata(options: MetadataOptions = {}): NibPlugin {
  const image = normalizeMetadataImage(options.image, 'Nib metadata image')
  const normalized = {
    ...options,
    ...(image === undefined ? {} : { image }),
    type: metadataType(options.type, 'Nib metadata type') ?? 'website',
    twitterCard: metadataTwitterCard(options.twitterCard, 'Nib metadata twitterCard')
      ?? 'summary_large_image',
    structuredData: options.structuredData ?? true,
  } satisfies NormalizedMetadataOptions
  return {
    name: '@briansunter/nib-metadata',
    renderer() {
      return {
        head(context: NibRenderPageContext) {
          return contribution(context, normalized)
        },
      }
    },
  }
}
