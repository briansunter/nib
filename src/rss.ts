import { definePlugin, type Awaitable, type NibRoutesPluginContext } from './framework/plugin'
import {
  deployedLinkUrl,
  deployedOrigin,
  deployedRouteUrl,
} from './framework/deployed-url'

/** A single item in an RSS 2.0 feed. Route paths are resolved against Nib's base. */
export interface RssItem {
  readonly title: string
  readonly link: string | URL
  readonly description?: string
  readonly content?: string
  readonly pubDate?: string | Date
  readonly guid?: string
  readonly author?: string
  readonly categories?: readonly string[]
  readonly enclosure?: {
    readonly url: string | URL
    readonly type: string
    readonly length?: number
  }
}

/** Context passed to a dynamic item provider. It is the same immutable route snapshot as routes(). */
export type RssItemsContext = Readonly<Pick<
  NibRoutesPluginContext,
  'command' | 'mode' | 'root' | 'base' | 'site' | 'routes'
>>

export interface RssOptions {
  /** Overrides site.origin. */
  readonly site?: string | URL
  /** Defaults to site.title. */
  readonly title?: string
  /** Defaults to site.description. */
  readonly description?: string
  /** Output route. Defaults to /rss.xml. */
  readonly path?: string
  readonly language?: string
  readonly copyright?: string
  readonly managingEditor?: string
  readonly webMaster?: string
  readonly ttl?: number
  readonly lastBuildDate?: string | Date
  /** Static items or an async provider using the immutable initial route manifest. */
  readonly items: readonly RssItem[] | ((context: RssItemsContext) => Awaitable<readonly RssItem[]>)
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function cdata(value: string): string {
  return `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
}

function requiredText(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Nib RSS ${name} must be a non-empty string`)
  }
  return value
}

function optionalText(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined
  return requiredText(value, name)
}

function rfc822Date(value: string | Date, name: string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) throw new Error(`Nib RSS ${name} must be a valid date`)
  return date.toUTCString()
}

function channelElement(name: string, value: string | undefined): string | undefined {
  return value === undefined ? undefined : `    <${name}>${escapeXml(value)}</${name}>`
}

function itemElement(name: string, value: string | undefined): string | undefined {
  return value === undefined ? undefined : `      <${name}>${escapeXml(value)}</${name}>`
}

function itemXml(item: RssItem, index: number, site: URL, base: string): string[] {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Nib RSS item ${index + 1} must be an object`)
  }
  const title = requiredText(item.title, `item ${index + 1} title`)
  const link = deployedLinkUrl(item.link, site, base, `Nib RSS item ${index + 1} link`)
  const description = optionalText(item.description, `item ${index + 1} description`)
  const content = optionalText(item.content, `item ${index + 1} content`)
  const guid = optionalText(item.guid, `item ${index + 1} guid`)
  const author = optionalText(item.author, `item ${index + 1} author`)
  const pubDate = item.pubDate === undefined
    ? undefined
    : rfc822Date(item.pubDate, `item ${index + 1} pubDate`)
  const categories = item.categories === undefined
    ? []
    : item.categories.map((category, categoryIndex) => (
      requiredText(category, `item ${index + 1} category ${categoryIndex + 1}`)
    ))
  const enclosure = item.enclosure
  if (enclosure !== undefined && (enclosure === null || typeof enclosure !== 'object')) {
    throw new Error(`Nib RSS item ${index + 1} enclosure must be an object`)
  }
  if (enclosure?.length !== undefined && (!Number.isInteger(enclosure.length) || enclosure.length < 0)) {
    throw new Error(`Nib RSS item ${index + 1} enclosure length must be a non-negative integer`)
  }

  return [
    '    <item>',
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    itemElement('description', description),
    content === undefined ? undefined : `      <content:encoded>${cdata(content)}</content:encoded>`,
    guid === undefined ? undefined : `      <guid>${escapeXml(guid)}</guid>`,
    author === undefined ? undefined : `      <author>${escapeXml(author)}</author>`,
    ...categories.map((category) => `      <category>${escapeXml(category)}</category>`),
    pubDate === undefined ? undefined : `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
    enclosure === undefined
      ? undefined
      : `      <enclosure url="${escapeXml(deployedLinkUrl(enclosure.url, site, base, `Nib RSS item ${index + 1} enclosure URL`))}" type="${escapeXml(requiredText(enclosure.type, `item ${index + 1} enclosure type`))}"${enclosure.length === undefined ? '' : ` length="${enclosure.length}"`} />`,
    '    </item>',
  ].filter((line): line is string => line !== undefined)
}

/** Generate a static RSS 2.0 resource route without adding browser runtime code. */
export function rss(options: RssOptions) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Nib RSS requires an options object')
  }
  if (options.site !== undefined) deployedOrigin(options.site, undefined, 'Nib RSS site')
  if (options.title !== undefined) requiredText(options.title, 'title')
  if (options.description !== undefined) requiredText(options.description, 'description')
  const routePath = options.path ?? '/rss.xml'
  if (!routePath.startsWith('/')) throw new Error('Nib RSS path must be an absolute route path')
  if (!Array.isArray(options.items) && typeof options.items !== 'function') {
    throw new Error('Nib RSS items must be an array or a function')
  }
  if (options.ttl !== undefined && (!Number.isInteger(options.ttl) || options.ttl < 0)) {
    throw new Error('Nib RSS ttl must be a non-negative integer')
  }
  const language = optionalText(options.language, 'language')
  const copyright = optionalText(options.copyright, 'copyright')
  const managingEditor = optionalText(options.managingEditor, 'managingEditor')
  const webMaster = optionalText(options.webMaster, 'webMaster')
  const lastBuildDate = options.lastBuildDate === undefined
    ? undefined
    : rfc822Date(options.lastBuildDate, 'lastBuildDate')

  return definePlugin({
    name: '@briansunter/nib/rss',
    async routes(context) {
      const site = deployedOrigin(options.site, context.site.origin, 'Nib RSS site')
      const title = requiredText(options.title ?? context.site.title, 'title')
      const description = requiredText(options.description ?? context.site.description, 'description')
      const items = typeof options.items === 'function'
        ? await options.items(context)
        : options.items
      if (!Array.isArray(items)) throw new Error('Nib RSS items provider must return an array')

      const channelUrl = deployedRouteUrl(site, context.base, '/')
      const feedUrl = deployedRouteUrl(site, context.base, routePath)
      const itemEntries = items.flatMap((item, index) => itemXml(item, index, site, context.base))
      return {
        kind: 'resource',
        path: routePath,
        contentType: 'application/rss+xml; charset=utf-8',
        body: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
          '  <channel>',
          `    <title>${escapeXml(title)}</title>`,
          `    <link>${escapeXml(channelUrl)}</link>`,
          `    <description>${escapeXml(description)}</description>`,
          `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
          channelElement('language', language),
          channelElement('copyright', copyright),
          channelElement('managingEditor', managingEditor),
          channelElement('webMaster', webMaster),
          lastBuildDate === undefined ? undefined : `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
          options.ttl === undefined ? undefined : `    <ttl>${options.ttl}</ttl>`,
          ...itemEntries,
          '  </channel>',
          '</rss>',
        ].filter((line): line is string => line !== undefined).join('\n'),
      } as const
    },
  })
}
