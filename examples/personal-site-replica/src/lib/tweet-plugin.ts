import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fromHtml } from 'hast-util-from-html'
import type { Root as HastRoot } from 'hast'
import type { Parent, Root, Text } from 'mdast'
import { visit } from 'unist-util-visit'
import { escapeHtml } from './html-utils'

export interface TweetUrlEntity {
  url: string
  expanded_url: string
  display_url: string
  indices: [number, number]
}

export interface TweetMentionEntity {
  screen_name: string
  name?: string
  id_str?: string
  indices: [number, number]
}

export interface TweetHashtagEntity {
  text: string
  indices: [number, number]
}

export interface TweetMediaEntity {
  type: 'photo' | 'video' | 'animated_gif'
  media_url?: string
  media_url_https?: string
  url?: string
  video_info?: {
    variants: Array<{
      content_type?: string
      url?: string
      bitrate?: number
    }>
  }
}

export interface TweetData {
  id_str: string
  text: string
  created_at: string
  favorite_count?: number
  conversation_count?: number
  user: {
    name: string
    screen_name: string
    profile_image_url_https: string
    profile_image_shape?: string
    is_blue_verified?: boolean
  }
  entities?: {
    media?: Array<TweetMediaEntity>
    urls?: Array<TweetUrlEntity>
    user_mentions?: Array<TweetMentionEntity>
    hashtags?: Array<TweetHashtagEntity>
  }
  mediaDetails?: Array<TweetMediaEntity>
  photos?: Array<{ url: string; width?: number; height?: number }>
  media?: Array<{ url?: string; media_url_https?: string }>
}

interface TweetNodeInfo {
  parent: Parent
  index: number
  tweetId: string
}

interface ProcessableEntity {
  type: 'url' | 'mention' | 'hashtag'
  indices: [number, number]
  replacement: string
}

interface MediaItem {
  type: 'photo' | 'video' | 'animated_gif'
  url: string
  videoUrl?: string
}

const TWEET_DIRECTIVE_RE = /^\s*\{\{\s*tweet\s+(.+?)\s*\}\}\s*$/
const TWEET_HOSTS = new Set([
  'x.com',
  'www.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
])

const tweetCachePath = [
  fileURLToPath(new URL('../data/tweet-cache.json', import.meta.url)),
  path.resolve(process.cwd(), 'src/data/tweet-cache.json'),
  path.resolve(
    process.cwd(),
    'examples/personal-site-replica/src/data/tweet-cache.json',
  ),
].find((candidate) => fs.existsSync(candidate))

let tweetCache: Record<string, TweetData> = {}
if (tweetCachePath) {
  try {
    tweetCache = JSON.parse(
      fs.readFileSync(tweetCachePath, 'utf8'),
    ) as Record<string, TweetData>
  } catch (error) {
    throw new Error(`Unable to read tweet cache at ${tweetCachePath}`, {
      cause: error,
    })
  }
}

export function getCachedTweet(tweetId: string): TweetData | undefined {
  return tweetCache[tweetId]
}

export function extractTweetId(value: string): string | null {
  const directive = value.match(TWEET_DIRECTIVE_RE)
  if (!directive) return null

  const target = directive[1]!.trim()
  if (/^\d+$/.test(target)) return target

  try {
    const url = new URL(target)
    if (!TWEET_HOSTS.has(url.hostname.toLowerCase())) return null

    const pathParts = url.pathname.split('/').filter(Boolean)
    const statusIndex = pathParts.indexOf('status')
    const tweetId = statusIndex >= 0 ? pathParts[statusIndex + 1] : undefined
    return tweetId && /^\d+$/.test(tweetId) ? tweetId : null
  } catch {
    return null
  }
}

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function externalLink(href: string, label: string): string {
  return `<a class="tweet-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
}

function parseEntities(text: string, entities: TweetData['entities']): string {
  if (!entities) return escapeHtml(text)

  const items: ProcessableEntity[] = []

  if (entities.urls) {
    for (const url of entities.urls) {
      const displayUrl = url.display_url ?? ''
      if (displayUrl.startsWith('pic.twitter.com')) continue
      const safeUrl = safeExternalUrl(url.expanded_url ?? '')
      items.push({
        type: 'url',
        indices: url.indices,
        replacement: safeUrl
          ? externalLink(safeUrl, displayUrl || safeUrl)
          : escapeHtml(displayUrl),
      })
    }
  }

  if (entities.user_mentions) {
    for (const mention of entities.user_mentions) {
      if (!mention.screen_name) continue
      items.push({
        type: 'mention',
        indices: mention.indices,
        replacement: externalLink(
          `https://twitter.com/${encodeURIComponent(mention.screen_name)}`,
          `@${mention.screen_name}`,
        ),
      })
    }
  }

  if (entities.hashtags) {
    for (const hashtag of entities.hashtags) {
      items.push({
        type: 'hashtag',
        indices: hashtag.indices,
        replacement: externalLink(
          `https://twitter.com/hashtag/${encodeURIComponent(hashtag.text)}`,
          `#${hashtag.text}`,
        ),
      })
    }
  }

  items.sort((a, b) => a.indices[0] - b.indices[0])

  const chars = Array.from(text)
  let cursor = 0
  let out = ''
  for (const item of items) {
    const [start, end] = item.indices
    if (start < cursor) continue
    out += escapeHtml(chars.slice(cursor, start).join(''))
    out += item.replacement
    cursor = end
  }
  out += escapeHtml(chars.slice(cursor).join(''))
  return out
}

const twitterVerified = `
<svg class="tweet-verified-badge" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-label="Verified account">
  <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="#1d9bf0"></path>
</svg>
`

const xLogo = `
<svg class="tweet-x-logo" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
  <g>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
  </g>
</svg>
`

const heartIcon = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
  <g>
    <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path>
  </g>
</svg>
`

const replyIcon = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
  <g>
    <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path>
  </g>
</svg>
`

function collectMediaItems(tweet: TweetData): MediaItem[] {
  const items: MediaItem[] = []

  function getMP4Url(
    variants:
      | Array<{ content_type?: string; url?: string; bitrate?: number }>
      | undefined,
  ): string | undefined {
    if (!Array.isArray(variants)) return undefined

    const mp4Variants = variants.filter(
      (variant) => variant.content_type === 'video/mp4',
    )
    if (mp4Variants.length === 0) return undefined

    const best = mp4Variants.sort(
      (a, b) => (b.bitrate || 0) - (a.bitrate || 0),
    )[0]
    return best?.url
  }

  if (tweet.entities?.media) {
    for (const media of tweet.entities.media) {
      if (media.type === 'video' || media.type === 'animated_gif') {
        const videoUrl = getMP4Url(media.video_info?.variants)
        if (videoUrl) {
          items.push({
            type: media.type,
            url: media.media_url_https || media.media_url || '',
            videoUrl,
          })
        }
      } else if (media.type === 'photo') {
        const url = media.media_url_https || media.media_url || ''
        if (url) items.push({ type: 'photo', url })
      }
    }
  }

  if (items.length === 0 && tweet.mediaDetails) {
    for (const media of tweet.mediaDetails) {
      if (media.type === 'video' || media.type === 'animated_gif') {
        const videoUrl = getMP4Url(media.video_info?.variants)
        if (videoUrl) {
          items.push({
            type: media.type,
            url:
              media.media_url_https || media.media_url || media.url || '',
            videoUrl,
          })
        }
      } else if (media.type === 'photo') {
        const url =
          media.media_url_https || media.media_url || media.url || ''
        if (url) items.push({ type: 'photo', url })
      }
    }
  }

  if (items.length === 0 && tweet.photos) {
    for (const photo of tweet.photos) {
      if (photo.url) items.push({ type: 'photo', url: photo.url })
    }
  }

  if (items.length === 0 && Array.isArray(tweet.media)) {
    for (const media of tweet.media) {
      const url = media.url || media.media_url_https
      if (url) items.push({ type: 'photo', url })
    }
  }

  return items
}

function createSingleImageElement(imageUrl: string): string {
  return `
    <div class="tweet-media">
      <img src="${escapeHtml(imageUrl)}" alt="Tweet media" loading="lazy"/>
    </div>`
}

function createImageGrid(photos: MediaItem[]): string {
  const count = Math.min(photos.length, 4)
  const gridClass = `tweet-media-grid tweet-media-grid-${count}`
  const imageItems = photos
    .slice(0, 4)
    .map(
      (photo) =>
        `<div class="tweet-grid-item"><img src="${escapeHtml(photo.url)}" alt="Tweet media" loading="lazy"/></div>`,
    )
    .join('')

  return `<div class="${gridClass}">${imageItems}</div>`
}

function createVideoElement(
  videoUrl: string,
  posterUrl: string,
  tweetUrl: string,
): string {
  return `
    <div class="tweet-video-container">
      <video class="tweet-video" controls preload="metadata" poster="${escapeHtml(posterUrl)}">
        <source src="${escapeHtml(videoUrl)}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
      <a href="${escapeHtml(tweetUrl)}" target="_blank" rel="noopener noreferrer" class="tweet-video-fallback" onclick="event.stopPropagation();">
        <span class="tweet-video-fallback-text">Click to watch on X</span>
      </a>
    </div>`
}

function createGifElement(videoUrl: string): string {
  return `
    <div class="tweet-gif-container">
      <video class="tweet-gif" loop autoplay muted playsinline preload="auto">
        <source src="${escapeHtml(videoUrl)}" type="video/mp4">
      </video>
      <span class="tweet-gif-badge">GIF</span>
    </div>`
}

function getMediaContent(tweet: TweetData, tweetUrl: string): string {
  const items = collectMediaItems(tweet)
  if (items.length === 0) return ''

  const videoItem = items.find(
    (item) =>
      (item.type === 'video' || item.type === 'animated_gif') && item.videoUrl,
  )
  if (videoItem?.videoUrl) {
    return videoItem.type === 'animated_gif'
      ? createGifElement(videoItem.videoUrl)
      : createVideoElement(videoItem.videoUrl, videoItem.url, tweetUrl)
  }

  const photos = items.filter((item) => item.type === 'photo')
  if (photos.length === 0) return ''
  if (photos.length === 1) return createSingleImageElement(photos[0]!.url)
  return createImageGrid(photos)
}

export function createTweetHtml(tweet: TweetData): string {
  const avatarClass =
    tweet.user.profile_image_shape === 'Circle'
      ? 'tweet-avatar'
      : 'tweet-avatar tweet-avatar-square'
  const verifiedBadge = tweet.user.is_blue_verified ? twitterVerified : ''
  const createdAt = new Date(tweet.created_at).toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const tweetText = tweet.text ?? ''
  const tweetTextHtml = parseEntities(tweetText, tweet.entities)
  const escapedUserName = escapeHtml(tweet.user.name)
  const escapedScreenName = escapeHtml(tweet.user.screen_name)
  const escapedProfileImage = escapeHtml(
    tweet.user.profile_image_url_https,
  )
  const escapedTweetId = escapeHtml(tweet.id_str)
  const favoriteCount = tweet.favorite_count ?? 0
  const conversationCount = tweet.conversation_count ?? 0

  const formatCount = (count: number): string => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
    return count.toString()
  }

  const tweetUrl = `https://twitter.com/${escapedScreenName}/status/${escapedTweetId}`
  const mediaContent = getMediaContent(tweet, tweetUrl)
  const isLongTweet =
    tweetText.length > 400 || (tweetText.match(/\n/g) || []).length >= 8
  const expandToggle = isLongTweet
    ? `<input type="checkbox" id="tweet-expand-${escapedTweetId}" class="tweet-expand-toggle" />`
    : ''
  const showMoreLabel = isLongTweet
    ? `<label for="tweet-expand-${escapedTweetId}" class="tweet-show-more">Show more</label>`
    : ''

  return `
  <div class="not-prose tweet-embed">
    <div class="tweet-card">
      <a href="${tweetUrl}" target="_blank" rel="noopener noreferrer" class="tweet-card-link" aria-label="View tweet by ${escapedUserName} on X"></a>
      <div class="tweet-header">
        <div class="tweet-author">
          <img src="${escapedProfileImage}" class="${avatarClass}" alt="${escapedUserName}'s avatar"/>
          <div class="tweet-author-info">
            <a href="${tweetUrl}" target="_blank" rel="noopener noreferrer" class="tweet-author-name-link">
              <div class="tweet-author-name-row">
                <span class="tweet-author-name">${escapedUserName}</span>
                ${verifiedBadge}
              </div>
            </a>
            <span class="tweet-author-handle">@${escapedScreenName}</span>
          </div>
        </div>
        <a href="${tweetUrl}" target="_blank" rel="noopener noreferrer" class="tweet-x-link" aria-label="View on X">${xLogo}</a>
      </div>
      ${expandToggle}
      <div class="tweet-body">${tweetTextHtml}</div>
      ${showMoreLabel}
      ${mediaContent}
      <a href="${tweetUrl}" target="_blank" rel="noopener noreferrer" class="tweet-timestamp-link">
        <span class="tweet-timestamp">${createdAt}</span>
      </a>
      <hr class="tweet-divider"/>
      <div class="tweet-actions">
        <div class="tweet-action tweet-action-like">
          ${heartIcon}
          <span>${formatCount(favoriteCount)}</span>
        </div>
        <div class="tweet-action tweet-action-reply">
          ${replyIcon}
          <span>${formatCount(conversationCount)}</span>
        </div>
      </div>
    </div>
  </div>
  `
}

/**
 * Resolve source tweet directives entirely from the imported persistent cache.
 * Like the source remark plugin, a standalone unavailable/deleted tweet is
 * removed. A directive embedded in a larger paragraph is not a tweet node and
 * remains authored text.
 */
export function remarkTweetCards() {
  return (tree: Root): void => {
    const tweetNodes: TweetNodeInfo[] = []

    visit(
      tree,
      'paragraph',
      (node, index: number | undefined, parent: Parent | undefined) => {
        if (parent === undefined || index === undefined) return
        if (node.children.length !== 1 || node.children[0]?.type !== 'text') {
          return
        }

        const tweetId = extractTweetId((node.children[0] as Text).value)
        if (tweetId) {
          tweetNodes.push({ parent, index, tweetId })
          return
        }

      },
    )

    for (let index = tweetNodes.length - 1; index >= 0; index -= 1) {
      const tweetNode = tweetNodes[index]!
      const tweetData = getCachedTweet(tweetNode.tweetId)
      if (tweetData) {
        tweetNode.parent.children[tweetNode.index] = {
          type: 'html',
          value: createTweetHtml(tweetData),
        }
      } else {
        tweetNode.parent.children.splice(tweetNode.index, 1)
      }
    }
  }
}

/**
 * Astro parses raw tweet-card HTML back into HAST before serialization. Nib
 * intentionally leaves arbitrary raw HTML untouched, so parse only the
 * trusted cache-rendered card nodes here. This preserves source entity and
 * attribute serialization without broadening raw-HTML handling.
 */
export function rehypeTweetCards() {
  return (tree: HastRoot): void => {
    visit(tree, 'raw', (node: any, index?: number, parent?: any) => {
      if (
        index === undefined
        || !parent
        || typeof node.value !== 'string'
        || !node.value.includes('class="not-prose tweet-embed"')
      ) {
        return
      }

      const fragment = fromHtml(node.value, { fragment: true })
      parent.children.splice(index, 1, ...fragment.children)
    })
  }
}
