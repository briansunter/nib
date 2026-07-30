import { deployedOrigin, deployedRouteUrl } from '../framework/deployed-url'
import { metadataImageSrc, normalizeMetadataImage } from '../framework/meta'
import type { NibPlugin, NibRenderPageContext } from '../framework/plugin'
import type { HeadAttributeValue, HeadContribution, HeadElement } from '../framework/types'

export interface MetadataOptions {
  /** A deployed route or absolute URL used for social previews. */
  readonly image?: string
  readonly type?: 'website' | 'article'
  readonly twitterCard?: 'summary' | 'summary_large_image'
  readonly siteName?: string
  readonly structuredData?: boolean
}

function absoluteUrl(value: string, context: NibRenderPageContext): string {
  if (/^https?:\/\//i.test(value)) return value
  const origin = deployedOrigin(context.origin, undefined, 'Nib metadata')
  return deployedRouteUrl(origin, context.base, value)
}

function contribution(
  context: NibRenderPageContext,
  options: Required<Pick<MetadataOptions, 'type' | 'twitterCard' | 'structuredData'>> & MetadataOptions,
): HeadContribution {
  const routeMeta = context.route.meta
  // Each social field falls back independently: a route override wins over the
  // plugin default without emitting the default value alongside it.
  const type = routeMeta.type ?? options.type
  const twitterCard = routeMeta.twitterCard ?? options.twitterCard
  const routeImage = normalizeMetadataImage(routeMeta.image, 'Page metadata image')
  const image = routeImage ?? options.image
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
  const normalized = {
    ...options,
    type: options.type ?? 'website',
    twitterCard: options.twitterCard ?? 'summary_large_image',
    structuredData: options.structuredData ?? true,
  } as Required<Pick<MetadataOptions, 'type' | 'twitterCard' | 'structuredData'>> & MetadataOptions
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
