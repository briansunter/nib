import fs from 'node:fs'
import path from 'node:path'
import type { Image, Parent, Root, Text } from 'mdast'
import type { Element, Root as HastRoot } from 'hast'
import rehypeFigure from '@microflash/rehype-figure'
import { rehypeGithubAlerts } from 'rehype-github-alerts'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm-no-autolink'
import remarkMath from 'remark-math'
import remarkSmartypants from 'remark-smartypants'
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
import { rehypeHeadingIds } from './heading-ids'
import { remarkMermaid } from './mermaid-plugin'
import { rehypeTweetCards, remarkTweetCards } from './tweet-plugin'
import { writingSlugs } from '../data/writing-slugs'
import { sourceRedirects } from '../redirects'

const pageRoot = path.resolve(process.cwd(), 'src/pages')
// This manifest is imported as build data instead of scanning relative to
// import.meta.url, which points inside dist/server after the SSR bundle runs.
const knownPermalinks = [...new Set([
  ...writingSlugs,
  ...Object.keys(sourceRedirects)
    .map((route) => route.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean),
])]
const knownPermalinkSet = new Set(knownPermalinks)
const permalinkAliases = new Map<string, string>()
for (const permalink of knownPermalinks) {
  const basename = permalink.split('/').at(-1) ?? permalink
  if (
    basename !== permalink
    && !knownPermalinkSet.has(basename)
    && !permalinkAliases.has(basename)
  ) {
    permalinkAliases.set(basename, permalink)
  }
}

/** Return the target portion of Obsidian's [[target|label]] syntax. */
export function wikilinkTarget(value: string): string {
  return value.split('|', 1)[0]!.trim()
}

function pageCandidates(name: string): string[] {
  const normalized = wikilinkTarget(name)
    .trim()
    .replace(/^notes\//i, '')
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase()
  const basename = normalized.split('/').at(-1) ?? normalized
  const resolved = knownPermalinkSet.has(normalized)
    ? normalized
    : permalinkAliases.get(normalized)
      ?? (knownPermalinkSet.has(basename) ? basename : permalinkAliases.get(basename))
  return [...new Set([resolved, normalized, basename].filter((value): value is string => Boolean(value)))]
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

function youtubeEmbedHtml(videoId: string): string {
  return `<div style="position: relative; display: flex; justify-content: center; align-items: center; margin: 10px 0;">
  <iframe
    width="100%"
    height="315"
    src="https://www.youtube.com/embed/${videoId}"
    title="YouTube video"
    frameborder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
    style="max-width: 600px; border-radius: 8px;"
  ></iframe>
</div>`
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
          value: youtubeEmbedHtml(youtube[1]!),
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
            ? youtubeEmbedHtml(youtubeId)
            : `<p><a href="${escapeHtml(source)}">Watch video</a></p>`,
        }
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

const IMAGE_FILENAME_RE = /([^/\\]+?)(?:\.[a-zA-Z0-9]+)?$/
const LOGSEQ_TIMESTAMP_RE = /[_-]?\d{10,}_?\d*$/

function altFromUrl(url: string): string {
  const match = url.match(IMAGE_FILENAME_RE)
  if (!match) return 'Image'
  const stem = match[1]!.replace(LOGSEQ_TIMESTAMP_RE, '').replace(/_+/g, ' ').trim()
  return stem.length > 0 ? stem : 'Image'
}

export function remarkNormalizeImageAlt() {
  return (tree: Root) => {
    visit(tree, 'image', (node: Image) => {
      const alt = typeof node.alt === 'string' ? node.alt.trim() : ''
      if (alt === '') node.alt = altFromUrl(node.url)
    })
    return tree
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

interface WikiLinkNode {
  type: 'wikiLink'
  value: string
  data?: {
    alias?: string
    hChildren?: Array<{ type: 'text'; value: string }>
    [key: string]: unknown
  }
}

/**
 * Keep the source site's adapter for Obsidian's [[target|label]] form. The
 * parser resolves the target through `wikilinkTarget`; this pass only updates
 * the rendered label while preserving its resolved permalink and existence.
 */
export function remarkWikilinkPipeAlias() {
  return (tree: Root) => {
    visit(tree, 'wikiLink', (node: WikiLinkNode) => {
      const separator = node.value.indexOf('|')
      if (separator === -1) return

      const target = node.value.slice(0, separator).trim()
      const alias = node.value.slice(separator + 1).trim() || target
      node.value = target
      node.data = {
        ...node.data,
        alias,
        hChildren: [{ type: 'text', value: alias }],
      }
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
      // remark-math emits display math as <pre><code class="language-math
      // math-display">. Leave that node intact for the following KaTeX pass.
      if (classes.includes('language-math') || classes.includes('math-display')) return
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
  // Astro enables smartypants by default before site-specific remark plugins.
  remarkSmartypants,
  remarkEmbeddedMedia,
  remarkTweetCards,
  remarkObsidianImageEmbed,
  remarkGfm,
  [remarkWikiLink, {
    permalinks: knownPermalinks,
    pageResolver: pageCandidates,
    hrefTemplate: (permalink: string) => `/${permalink}`,
  }],
  remarkWikilinkPipeAlias,
  remarkWikilinkValidate,
  remarkRemoveHiddenImages,
  remarkNormalizeImageAlt,
  remarkMath,
  remarkMermaid,
]

/**
 * Match the source site's video-node contract before rehype-figure sees the
 * original Markdown image. Autoplay-marked videos are driven by the
 * IntersectionObserver enhancement instead of the HTML autoplay attribute.
 */
export function rehypeSourceVideos() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') return

      const source = String(node.properties?.src ?? '')
      if (!/^\/videos\//i.test(source)) return

      const alt = String(node.properties?.alt ?? '')
      const shouldAutoplay = /\bautoplay\b/i.test(alt)

      node.tagName = 'video'
      node.properties = {
        className: ['post-video'],
        src: source,
        alt,
        controls: !shouldAutoplay,
        preload: 'none',
        ...(shouldAutoplay
          ? {
              muted: true,
              playsInline: true,
              loop: true,
              dataAutoplayVideo: true,
            }
          : {}),
      }
      node.children = []
    })
  }
}

export const rehypePlugins: any[] = [
  rehypeShiki,
  [rehypeKatex, { output: 'html' }],
  rehypeSourceVideos,
  rehypeFigure,
  // Parse trusted cached tweet-card HTML only after figure processing so its
  // avatar and media images retain the source card structure.
  rehypeTweetCards,
  rehypeGithubAlerts,
  rehypeHeadingIds,
]
