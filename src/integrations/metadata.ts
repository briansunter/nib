import { deployedOrigin, deployedRouteUrl } from '../framework/deployed-url'
import type { NibPlugin, NibRenderPageContext } from '../framework/plugin'
import type { HeadContribution } from '../framework/types'

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
  const image = routeMeta.image ?? options.image
  const elements: NonNullable<HeadContribution['elements']>[number][] = []
  let url: string | undefined
  if (context.origin !== undefined) {
    url = deployedRouteUrl(
      deployedOrigin(context.origin, undefined, 'Nib metadata'),
      context.base,
      context.route.path,
    )
    elements.push({ tag: 'link', attributes: { rel: 'canonical', href: url } })
  }
  const addMeta = (attributes: Record<string, string>) => {
    elements.push({ tag: 'meta', attributes })
  }
  addMeta({ property: 'og:title', content: context.route.meta.title })
  if (context.route.meta.description !== undefined) {
    addMeta({ property: 'og:description', content: context.route.meta.description })
  }
  addMeta({ property: 'og:type', content: type })
  if (url !== undefined) addMeta({ property: 'og:url', content: url })
  if (options.siteName !== undefined) addMeta({ property: 'og:site_name', content: options.siteName })
  addMeta({ name: 'twitter:card', content: twitterCard })
  addMeta({ name: 'twitter:title', content: context.route.meta.title })
  if (context.route.meta.description !== undefined) {
    addMeta({ name: 'twitter:description', content: context.route.meta.description })
  }
  if (image !== undefined) {
    addMeta({ property: 'og:image', content: absoluteUrl(image, context) })
    addMeta({ name: 'twitter:image', content: absoluteUrl(image, context) })
  }
  if (options.structuredData && url !== undefined) {
    elements.push({
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
