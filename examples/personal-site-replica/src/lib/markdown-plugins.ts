import fs from 'node:fs'
import path from 'node:path'
import type { Parent, Root, Text } from 'mdast'
import type { Element, Root as HastRoot } from 'hast'
import rehypeFigure from '@microflash/rehype-figure'
import { rehypeGithubAlerts } from 'rehype-github-alerts'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm-no-autolink'
import remarkMath from 'remark-math'
import remarkWikiLink from 'remark-wiki-link'
import { visit } from 'unist-util-visit'
import { codeToHast, createHighlighterCoreSync } from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import bash from '@shikijs/langs/bash'
import css from '@shikijs/langs/css'
import dockerfile from '@shikijs/langs/dockerfile'
import html from '@shikijs/langs/html'
import javascript from '@shikijs/langs/javascript'
import json from '@shikijs/langs/json'
import jsx from '@shikijs/langs/jsx'
import markdown from '@shikijs/langs/markdown'
import python from '@shikijs/langs/python'
import sql from '@shikijs/langs/sql'
import tsx from '@shikijs/langs/tsx'
import typescript from '@shikijs/langs/typescript'
import xml from '@shikijs/langs/xml'
import yaml from '@shikijs/langs/yaml'
import githubDark from '@shikijs/themes/github-dark'

const pageRoot = path.resolve(new URL('../pages', import.meta.url).pathname)

interface TweetSnapshot {
  id_str?: string
  text?: string
  created_at?: string
  favorite_count?: number
  conversation_count?: number
  user?: {
    name?: string
    screen_name?: string
    profile_image_url_https?: string
    profile_image_shape?: string
    is_blue_verified?: boolean
  }
  entities?: {
    urls?: Array<{ url?: string; expanded_url?: string; display_url?: string }>
  }
  mediaDetails?: Array<{
    type?: string
    media_url_https?: string
    url?: string
    video_info?: { variants?: Array<{ content_type?: string; url?: string; bitrate?: number }> }
  }>
  photos?: Array<{ url?: string }>
  video?: {
    poster?: string
    variants?: Array<{ type?: string; src?: string }>
  }
}

const tweetCachePath = [
  path.resolve(process.cwd(), 'src/content/tweet-cache.json'),
  path.resolve(process.cwd(), 'examples/personal-site-replica/src/content/tweet-cache.json'),
  path.resolve(pageRoot, '../content/tweet-cache.json'),
].find((candidate) => fs.existsSync(candidate))
let tweetCache: Record<string, TweetSnapshot> = {}
try {
  if (tweetCachePath) tweetCache = JSON.parse(fs.readFileSync(tweetCachePath, 'utf8')) as Record<string, TweetSnapshot>
} catch {
  // A missing cache leaves a useful external-link fallback in the article.
}

function markdownPages(directory: string, relative = ''): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }

  return entries.flatMap((entry) => {
    const file = path.join(directory, entry.name)
    const route = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) return markdownPages(file, route)
    return entry.name === 'page.md' ? [relative] : []
  })
}

const knownPermalinks = markdownPages(pageRoot).filter(Boolean)

function pageCandidates(name: string): string[] {
  const normalized = name
    .trim()
    .replace(/^notes\//i, '')
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
  const basename = normalized.split('/').at(-1) ?? normalized
  return [...new Set([normalized, basename])]
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function paragraphText(node: { children?: Array<{ type: string; value?: string }> }): string | null {
  if (!node.children || node.children.length !== 1 || node.children[0]?.type !== 'text') return null
  return node.children[0].value ?? null
}

const tweetHosts = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'])

function extractTweetId(target: string): string | null {
  if (/^\d+$/.test(target)) return target
  try {
    const url = new URL(target)
    if (!tweetHosts.has(url.hostname.toLowerCase())) return null
    const parts = url.pathname.split('/').filter(Boolean)
    const statusIndex = parts.indexOf('status')
    const id = statusIndex >= 0 ? parts[statusIndex + 1] : undefined
    return id && /^\d+$/.test(id) ? id : null
  } catch {
    return null
  }
}

function formatTweetCount(count: number | undefined): string {
  const value = count ?? 0
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

function tweetTextHtml(tweet: TweetSnapshot): string {
  let html = escapeHtml(tweet.text ?? '')
  for (const entity of tweet.entities?.urls ?? []) {
    if (!entity.url) continue
    const display = entity.display_url || entity.expanded_url || entity.url
    html = html.replace(
      escapeHtml(entity.url),
      `<a class="tweet-link" href="${escapeHtml(entity.expanded_url || entity.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(display)}</a>`,
    )
  }
  return html
}

function tweetMediaHtml(tweet: TweetSnapshot, tweetUrl: string): string {
  const media = tweet.mediaDetails?.[0]
  const photoUrl = media?.type === 'photo' ? media.media_url_https : tweet.photos?.[0]?.url
  if (photoUrl) {
    return `<div class="tweet-media"><img src="${escapeHtml(photoUrl)}" alt="Tweet media" loading="lazy" /></div>`
  }

  const video = tweet.video
  const videoVariant = video?.variants?.find((variant) => variant.type === 'video/mp4' && variant.src)
    ?? media?.video_info?.variants?.filter((variant) => variant.content_type === 'video/mp4' && variant.url).sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]
  const videoSrc = videoVariant && (('src' in videoVariant && videoVariant.src) || ('url' in videoVariant && videoVariant.url))
  const poster = video?.poster || media?.media_url_https
  if (!videoSrc && !poster) return ''
  if (!videoSrc) return `<div class="tweet-media"><img src="${escapeHtml(poster!)}" alt="Tweet media" loading="lazy" /></div>`
  return `<div class="tweet-media"><video class="tweet-video" controls preload="metadata"${poster ? ` poster="${escapeHtml(poster)}"` : ''}><source src="${escapeHtml(videoSrc)}" type="video/mp4" /><a href="${escapeHtml(tweetUrl)}" target="_blank" rel="noopener noreferrer">Watch on X</a></video></div>`
}

function tweetHtml(tweetId: string, tweet: TweetSnapshot): string {
  const id = tweet.id_str || tweetId
  const userName = tweet.user?.name || 'X user'
  const screenName = tweet.user?.screen_name || 'user'
  const tweetUrl = `https://twitter.com/${encodeURIComponent(screenName)}/status/${encodeURIComponent(id)}`
  const longTweet = (tweet.text ?? '').length > 400 || (tweet.text?.match(/\n/g) ?? []).length >= 8
  const toggleId = `tweet-expand-${id}`
  const createdAt = tweet.created_at
    ? new Date(tweet.created_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, month: 'short', day: 'numeric', year: 'numeric' })
    : ''
  const avatarClass = tweet.user?.profile_image_shape === 'Circle' ? 'tweet-avatar' : 'tweet-avatar tweet-avatar-square'
  const media = tweetMediaHtml(tweet, tweetUrl)

  return `<div class="not-prose tweet-embed" data-tweet-id="${escapeHtml(id)}">
    <div class="tweet-card">
      <a href="${tweetUrl}" target="_blank" rel="noopener noreferrer" class="tweet-card-link" aria-label="View tweet by ${escapeHtml(userName)} on X"></a>
      <div class="tweet-header">
        <div class="tweet-author">
          ${tweet.user?.profile_image_url_https ? `<img src="${escapeHtml(tweet.user.profile_image_url_https)}" class="${avatarClass}" alt="${escapeHtml(userName)}'s avatar" loading="lazy" />` : ''}
          <div class="tweet-author-info">
            <a href="${tweetUrl}" target="_blank" rel="noopener noreferrer" class="tweet-author-name-link">
              <div class="tweet-author-name-row"><span class="tweet-author-name">${escapeHtml(userName)}</span>${tweet.user?.is_blue_verified ? '<span class="tweet-verified-badge" aria-label="Verified">✓</span>' : ''}</div>
            </a>
            <span class="tweet-author-handle">@${escapeHtml(screenName)}</span>
          </div>
        </div>
        <a href="${tweetUrl}" target="_blank" rel="noopener noreferrer" class="tweet-x-link" aria-label="View on X"><span class="tweet-x-logo" aria-hidden="true">𝕏</span></a>
      </div>
      ${longTweet ? `<input type="checkbox" id="${toggleId}" class="tweet-expand-toggle" />` : ''}
      <div class="tweet-body">${tweetTextHtml(tweet)}</div>
      ${longTweet ? `<label for="${toggleId}" class="tweet-show-more">Show more</label>` : ''}
      ${media}
      <a href="${tweetUrl}" target="_blank" rel="noopener noreferrer" class="tweet-timestamp-link"><span class="tweet-timestamp">${createdAt}</span></a>
      <hr class="tweet-divider" />
      <div class="tweet-actions"><div class="tweet-action tweet-action-like"><span aria-hidden="true">♥</span><span>${formatTweetCount(tweet.favorite_count)}</span></div><div class="tweet-action tweet-action-reply"><span aria-hidden="true">↩</span><span>${formatTweetCount(tweet.conversation_count)}</span></div></div>
    </div>
  </div>`
}

function tweetFallbackHtml(tweetId: string): string {
  const tweetUrl = `https://twitter.com/i/status/${encodeURIComponent(tweetId)}`
  return `<div class="not-prose tweet-embed tweet-embed-fallback" data-tweet-id="${escapeHtml(tweetId)}"><a href="${tweetUrl}" target="_blank" rel="noopener noreferrer">View this post on X</a></div>`
}

/** Render the reference site's shortcode syntax without a network request. */
export function remarkEmbeddedMedia() {
  return (tree: Root) => {
    visit(tree, 'paragraph', (node: any, index?: number, parent?: Parent) => {
      if (index === undefined || !parent) return
      const value = paragraphText(node)
      if (!value) return

      const youtube = value.trim().match(/^\{\{\s*<\s*youtube\s+([A-Za-z0-9_-]{6,})\s*>\s*\}\}$/i)
      if (youtube) {
        parent.children[index] = {
          type: 'html',
          value: `<div class="media-embed media-embed--youtube"><iframe src="https://www.youtube.com/embed/${youtube[1]}" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`,
        }
        return
      }

      const video = value.trim().match(/^\{\{\s*video\s+(https?:\/\/[^\s}]+)\s*\}\}$/i)
      if (video) {
        const source = video[1]
        const youtubeId = source.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i)?.[1]
        parent.children[index] = {
          type: 'html',
          value: youtubeId
            ? `<div class="media-embed media-embed--youtube"><iframe src="https://www.youtube.com/embed/${youtubeId}" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
            : `<p><a href="${escapeHtml(source)}">Watch video</a></p>`,
        }
        return
      }

      const tweet = value.trim().match(/^\{\{\s*tweet\s+(.+?)\s*\}\}$/i)
      if (tweet) {
        const target = tweet[1]!.trim()
        const tweetId = extractTweetId(target)
        if (tweetId) {
          parent.children[index] = {
            type: 'html',
            value: tweetCache[tweetId] ? tweetHtml(tweetId, tweetCache[tweetId]) : tweetFallbackHtml(tweetId),
          }
        }
      }
    })
  }
}

/** Keep mermaid as a semantic client-rendered diagram instead of raw fenced code. */
export function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, 'code', (node: any, index?: number, parent?: Parent) => {
      if (index === undefined || !parent || node.lang?.toLowerCase() !== 'mermaid') return
      parent.children[index] = {
        type: 'html',
        value: `<div class="mermaid" data-mermaid-source="${escapeHtml(String(node.value ?? ''))}">${escapeHtml(String(node.value ?? ''))}</div>`,
      }
    })
  }
}

export function remarkRemoveHiddenImages() {
  return (tree: Root) => {
    visit(tree, 'image', (node: any, index?: number, parent?: Parent) => {
      if (index === undefined || !parent || !/\|\s*hidden\s*(?:\||$)/i.test(node.alt ?? '')) return
      parent.children.splice(index, 1)
    })
  }
}

export function remarkNormalizeImageAlt() {
  return (tree: Root) => {
    visit(tree, 'image', (node: any) => {
      if (typeof node.alt !== 'string' || node.alt.trim() !== '') return
      const filename = node.url?.split('/').at(-1)?.replace(/\.[^.]+$/, '') ?? 'Image'
      node.alt = filename.replace(/[_-]+/g, ' ').replace(/\d{10,}.*$/, '').trim() || 'Image'
    })
  }
}

/** Resolve the Obsidian image form used by older writing entries when present. */
export function remarkObsidianImageEmbed() {
  return (tree: Root, file: { path?: string }) => {
    visit(tree, 'text', (node: Text, index?: number, parent?: Parent) => {
      if (index === undefined || !parent || !node.value.includes('![[')) return
      const pattern = /!\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g
      const children: Array<Text | { type: 'image'; url: string; alt: string }> = []
      let cursor = 0
      for (const match of node.value.matchAll(pattern)) {
        const start = match.index ?? 0
        if (start > cursor) children.push({ type: 'text', value: node.value.slice(cursor, start) })
        const name = match[1]!.trim()
        const alt = match[2]?.trim() || name
        const sourceFile = path.resolve(path.dirname(file.path ?? ''), name)
        const vaultFile = path.resolve(pageRoot, '../assets/site-assets', name)
        const resolved = fs.existsSync(sourceFile) ? sourceFile : fs.existsSync(vaultFile) ? vaultFile : undefined
        if (resolved) {
          children.push({ type: 'image', url: `/site-assets/${path.relative(path.resolve(pageRoot, '../assets/site-assets'), resolved).replaceAll(path.sep, '/')}`, alt })
        } else {
          children.push({ type: 'text', value: match[0] })
        }
        cursor = start + match[0].length
      }
      if (children.length === 0) return
      if (cursor < node.value.length) children.push({ type: 'text', value: node.value.slice(cursor) })
      parent.children.splice(index, 1, ...children as any)
    })
  }
}

export function remarkWikilinkValidate() {
  return (tree: Root) => {
    visit(tree, 'wikiLink', (node: any, index?: number, parent?: Parent) => {
      if (index === undefined || !parent || node.data?.exists) return
      const label = node.data?.alias || node.value || ''
      parent.children.splice(index, 1, { type: 'text', value: label })
    })
  }
}

const highlighter = createHighlighterCoreSync({
  themes: [githubDark],
  langs: [bash, css, dockerfile, html, javascript, json, jsx, markdown, python, sql, tsx, typescript, xml, yaml],
  engine: createJavaScriptRegexEngine(),
})

const languageAliases: Record<string, string> = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', sh: 'bash', shell: 'bash', yml: 'yaml', md: 'markdown', mdx: 'markdown', html: 'html',
}

function textContent(node: any): string {
  if (node.type === 'text') return node.value ?? ''
  return (node.children ?? []).map(textContent).join('')
}

/** Synchronous Shiki output keeps Nib's current build contract intact. */
export function rehypeShiki() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element, index?: number, parent?: any) => {
      if (node.tagName !== 'pre' || index === undefined || !parent) return
      const code = node.children.find((child: any) => child.type === 'element' && child.tagName === 'code') as Element | undefined
      if (!code) return
      const className = code.properties?.className
      const classes = Array.isArray(className) ? className.map(String) : [String(className ?? '')]
      const requested = classes.find((entry) => entry.startsWith('language-'))?.slice('language-'.length) ?? 'plaintext'
      const normalized = languageAliases[requested.toLowerCase()] ?? requested.toLowerCase()
      const loaded = highlighter.getLoadedLanguages()
      const lang = loaded.includes(normalized) ? normalized : 'plaintext'
      const source = textContent(code).replace(/\n$/, '')
      const highlighted = codeToHast(highlighter, source, { lang, theme: 'github-dark' })
      const highlightedPre = highlighted.children.find((child: any) => child.type === 'element' && child.tagName === 'pre') as Element | undefined
      if (!highlightedPre) return
      highlightedPre.properties = {
        ...highlightedPre.properties,
        class: 'astro-code github-dark',
        style: `${String(highlightedPre.properties?.style ?? '')}; overflow-x: auto;`,
        tabindex: '0',
        'data-language': requested,
      }
      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-block-wrapper'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-block-header'] },
            children: [
              { type: 'element', tagName: 'span', properties: { className: ['code-block-lang'] }, children: [{ type: 'text', value: requested }] },
              {
                type: 'element',
                tagName: 'button',
                properties: {
                  type: 'button',
                  className: ['copy-button'],
                  'data-copy-button': true,
                  'data-code': source,
                  ariaLabel: 'Copy code to clipboard',
                  title: 'Copy code to clipboard',
                },
                children: [{ type: 'text', value: 'Copy' }],
              },
            ],
          },
          highlightedPre,
        ],
      }
      parent.children[index] = wrapper
    })
  }
}

export const remarkPlugins: any[] = [
  remarkEmbeddedMedia,
  remarkObsidianImageEmbed,
  remarkGfm,
  [remarkWikiLink, {
    permalinks: knownPermalinks,
    pageResolver: pageCandidates,
    hrefTemplate: (permalink: string) => `/${permalink}`,
    aliasDivider: '|',
  }],
  remarkWikilinkValidate,
  remarkRemoveHiddenImages,
  remarkNormalizeImageAlt,
  remarkMath,
  remarkMermaid,
]

export const rehypePlugins: any[] = [
  rehypeShiki,
  [rehypeKatex, { output: 'html' }],
  rehypeFigure,
  rehypeGithubAlerts,
]
