import { definePlugin, type Awaitable, type NibRoutesPluginContext } from '../framework/plugin'
import {
  deployedLinkUrl,
  deployedOrigin,
  deployedRouteUrl,
} from '../framework/deployed-url'
import { publicRouteHref } from '../framework/publication'
import type { CollectionCapability } from '../framework/types'
import { escapeXml, isCollectionCapability, resourcePath } from './shared'

/** A single item in an RSS 2.0 feed. Route paths are resolved against Nib's base. */
export interface RssItem {
  readonly title: string
  readonly link: string | URL
  readonly description?: string
  readonly content?: string
  readonly pubDate?: string | Date
  readonly guid?: string
  readonly author?: string
  /** Dublin Core creator; emitted as <dc:creator> when provided. */
  readonly creator?: string
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
  'command' | 'mode' | 'root' | 'base' | 'origin' | 'routes' | 'readCollection'
>>

export interface RssOptions {
  /** Overrides the configured deployment origin. */
  readonly origin?: string | URL
  /** RSS channel title. */
  readonly title: string
  /** RSS channel description. */
  readonly description: string
  /** Output route. Defaults to /rss.xml. */
  readonly path?: string
  readonly language?: string
  readonly copyright?: string
  readonly managingEditor?: string
  readonly webMaster?: string
  readonly ttl?: number
  readonly lastBuildDate?: string | Date
  /** Local route, feed-relative path, or HTTP(S) URL for an XSL stylesheet. */
  readonly stylesheet?: string
  /** Static items or an async provider using the current immutable route manifest. */
  readonly items:
    | readonly RssItem[]
    | CollectionCapability<readonly RssItem[]>
    | ((context: RssItemsContext) => Awaitable<readonly RssItem[]>)
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

function stylesheetHref(
  value: string,
  origin: URL,
  base: string,
  feedPath: string,
): string {
  const authored = value.trim()
  if (authored.startsWith('/') && !authored.startsWith('//')) {
    return publicRouteHref(base, authored)
  }
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(authored)) {
    return deployedLinkUrl(authored, origin, base, 'Nib RSS stylesheet')
  }

  let resolved: URL
  try {
    resolved = new URL(authored, deployedRouteUrl(origin, base, feedPath))
  } catch {
    throw new Error('Nib RSS stylesheet must be a valid URL reference')
  }
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    throw new Error('Nib RSS stylesheet must use HTTP or HTTPS')
  }
  if (authored.startsWith('//') || resolved.origin !== origin.origin) {
    return resolved.href
  }
  return `${resolved.pathname}${resolved.search}${resolved.hash}`
}

function itemXml(item: RssItem, index: number, origin: URL, base: string): string[] {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Nib RSS item ${index + 1} must be an object`)
  }
  const title = requiredText(item.title, `item ${index + 1} title`)
  const link = deployedLinkUrl(item.link, origin, base, `Nib RSS item ${index + 1} link`)
  const description = optionalText(item.description, `item ${index + 1} description`)
  const content = optionalText(item.content, `item ${index + 1} content`)
  const guid = optionalText(item.guid, `item ${index + 1} guid`)
  const author = optionalText(item.author, `item ${index + 1} author`)
  const creator = optionalText(item.creator, `item ${index + 1} creator`)
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
    creator === undefined ? undefined : `      <dc:creator>${cdata(creator)}</dc:creator>`,
    ...categories.map((category) => `      <category>${escapeXml(category)}</category>`),
    pubDate === undefined ? undefined : `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
    enclosure === undefined
      ? undefined
      : `      <enclosure url="${escapeXml(deployedLinkUrl(enclosure.url, origin, base, `Nib RSS item ${index + 1} enclosure URL`))}" type="${escapeXml(requiredText(enclosure.type, `item ${index + 1} enclosure type`))}"${enclosure.length === undefined ? '' : ` length="${enclosure.length}"`} />`,
    '    </item>',
  ].filter((line): line is string => line !== undefined)
}

/** Generate a static RSS 2.0 resource route without adding browser runtime code. */
export function rss(options: RssOptions) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Nib RSS requires an options object')
  }
  if (options.origin !== undefined) deployedOrigin(options.origin, undefined, 'Nib RSS origin')
  requiredText(options.title, 'title')
  requiredText(options.description, 'description')
  const routePath = resourcePath(options.path ?? '/rss.xml', 'Nib RSS')
  if (
    !Array.isArray(options.items)
    && typeof options.items !== 'function'
    && !isCollectionCapability(options.items)
  ) {
    throw new Error('Nib RSS items must be an array, function, or collection capability')
  }
  if (options.ttl !== undefined && (!Number.isInteger(options.ttl) || options.ttl < 0)) {
    throw new Error('Nib RSS ttl must be a non-negative integer')
  }
  if (options.stylesheet !== undefined && (typeof options.stylesheet !== 'string' || options.stylesheet.trim() === '')) {
    throw new Error('Nib RSS stylesheet must be a non-empty string')
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
      const origin = deployedOrigin(options.origin, context.origin, 'Nib RSS origin')
      const title = requiredText(options.title, 'title')
      const description = requiredText(options.description, 'description')
      const items = typeof options.items === 'function'
        ? await options.items(context)
        : isCollectionCapability<readonly RssItem[]>(options.items)
          ? context.readCollection(options.items)
          : options.items
      if (!Array.isArray(items)) throw new Error('Nib RSS items provider must return an array')

      const channelUrl = deployedRouteUrl(origin, context.base, '/')
      const feedUrl = deployedRouteUrl(origin, context.base, routePath)
      const stylesheetUrl = options.stylesheet === undefined
        ? undefined
        : stylesheetHref(options.stylesheet, origin, context.base, routePath)
      const itemEntries = items.flatMap((item, index) => itemXml(item, index, origin, context.base))
      return {
        kind: 'resource',
        path: routePath,
        contentType: 'application/rss+xml; charset=utf-8',
        body: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          stylesheetUrl === undefined
            ? undefined
            : `<?xml-stylesheet type="text/xsl" href="${escapeXml(stylesheetUrl)}"?>`,
          '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">',
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
