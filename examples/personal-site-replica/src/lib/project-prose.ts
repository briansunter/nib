import {
  codeToHast,
  createHighlighterCoreSync,
  hastToHtml,
} from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import bash from '@shikijs/langs/bash'
import json from '@shikijs/langs/json'
import python from '@shikijs/langs/python'
import rust from '@shikijs/langs/rust'
import tsx from '@shikijs/langs/tsx'
import typescript from '@shikijs/langs/typescript'
import yaml from '@shikijs/langs/yaml'
import githubDark from '@shikijs/themes/github-dark'
import type { Element, Root } from 'hast'
import { retext } from 'retext'
import smartypants from 'retext-smartypants'

const CODE_BLOCK_PATTERN = /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi
const HEADING_PATTERN = /<h([2-6])([^>]*)>([\s\S]*?)<\/h\1>/gi
const IMAGE_PARAGRAPH_PATTERN = /<p>\s*(<img\b[^>]*>)\s*<\/p>/gi
const projectHighlighter = createHighlighterCoreSync({
  themes: [githubDark],
  langs: [bash, json, python, rust, tsx, typescript, yaml],
  engine: createJavaScriptRegexEngine(),
})
const smartypantsProcessor = retext().use(smartypants, {
  ellipses: false,
  dashes: false,
  backticks: false,
})
const LANGUAGE_ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  yml: 'yaml',
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function plainText(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, ''))
}

function headingSlug(value: string): string {
  return plainText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')
}

function addHeadingIds(html: string): string {
  const seen = new Map<string, number>()

  return html.replace(
    HEADING_PATTERN,
    (heading, level: string, attributes: string, children: string) => {
      if (/\bid\s*=/i.test(attributes)) return heading

      const base = headingSlug(children)
      if (!base) return heading

      const duplicateIndex = seen.get(base) ?? 0
      seen.set(base, duplicateIndex + 1)
      const id = duplicateIndex === 0 ? base : `${base}-${duplicateIndex}`
      return `<h${level}${attributes} id="${id}">${children}</h${level}>`
    },
  )
}

function addFigures(html: string): string {
  return html.replace(
    IMAGE_PARAGRAPH_PATTERN,
    (_paragraph, image: string) => {
      const alt = image.match(/\balt=(["'])(.*?)\1/i)?.[2] ?? ''
      const caption = alt ? `<figcaption>${alt}</figcaption>` : ''
      return `<figure>${image}${caption}</figure>`
    },
  )
}

function smartTypography(html: string): string {
  const ignoredElements = new Set(['code', 'pre', 'script', 'style'])
  let ignoredDepth = 0

  return html
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (!part.startsWith('<')) {
        if (ignoredDepth > 0 || part.length === 0) return part
        const decodedQuotes = part
          .replace(/&#(?:39|x27);/gi, "'")
          .replace(/&(?:apos|quot);/gi, (entity) =>
            entity.toLowerCase() === '&quot;' ? '"' : "'")
        return smartypantsProcessor.processSync(decodedQuotes).toString()
      }

      const closingTag = part.match(/^<\s*\/\s*([a-z0-9-]+)/i)?.[1]?.toLowerCase()
      if (closingTag && ignoredElements.has(closingTag)) {
        ignoredDepth = Math.max(0, ignoredDepth - 1)
        return part
      }

      const openingTag = part.match(/^<\s*([a-z0-9-]+)/i)?.[1]?.toLowerCase()
      if (
        openingTag
        && ignoredElements.has(openingTag)
        && !/\/\s*>$/.test(part)
      ) {
        ignoredDepth += 1
      }
      return part
    })
    .join('')
}

function languageFromAttributes(attributes: string): string {
  return attributes.match(/\bclass=(["'])[^"']*\blanguage-([^\s"']+)/i)?.[2]
    ?? 'plaintext'
}

function sourceCopyButtonChildren(): Element[] {
  return [
    {
      type: 'element',
      tagName: 'svg',
      properties: {
        className: ['copy-icon'],
        fill: 'none',
        viewBox: '0 0 24 24',
        stroke: 'currentColor',
        strokeWidth: '2',
        ariaHidden: 'true',
      },
      children: [
        {
          type: 'element',
          tagName: 'path',
          properties: {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            d: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
          },
          children: [],
        },
      ],
    },
    {
      type: 'element',
      tagName: 'span',
      properties: { className: ['copy-button-label'] },
      children: [{ type: 'text', value: 'Copy' }],
    },
  ]
}

function highlightedCodeBlock(source: string, requestedLanguage: string): Root {
  const normalizedLanguage =
    LANGUAGE_ALIASES[requestedLanguage.toLowerCase()]
    ?? requestedLanguage.toLowerCase()
  const language = projectHighlighter
    .getLoadedLanguages()
    .includes(normalizedLanguage)
    ? normalizedLanguage
    : 'plaintext'
  const highlighted = codeToHast(projectHighlighter, source, {
    lang: language,
    theme: 'github-dark',
  })
  const highlightedPre = highlighted.children.find(
    (child): child is Element =>
      child.type === 'element' && child.tagName === 'pre',
  )
  if (!highlightedPre) return highlighted

  highlightedPre.properties = {
    ...highlightedPre.properties,
    class: 'astro-code github-dark',
    style: `${String(highlightedPre.properties?.style ?? '')}; overflow-x: auto;`,
    tabindex: '0',
    'data-language': requestedLanguage,
  }

  return {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-block-wrapper'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-block-header'] },
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: { className: ['code-block-lang'] },
                children: [{ type: 'text', value: requestedLanguage }],
              },
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
                children: sourceCopyButtonChildren(),
              },
            ],
          },
          highlightedPre,
        ],
      },
    ],
  }
}

function highlightCodeBlocks(html: string): string {
  return html.replace(
    CODE_BLOCK_PATTERN,
    (_block, attributes: string, encodedSource: string) => {
      const language = languageFromAttributes(attributes)
      const source = decodeHtml(encodedSource).replace(/\n$/, '')
      return hastToHtml(highlightedCodeBlock(source, language))
    },
  )
}

/**
 * Project bodies arrive as Marked HTML instead of Nib Markdown pages. Apply
 * the source site's order-sensitive prose transforms before server rendering.
 */
export function renderProjectProse(bodyHtml: string): string {
  return highlightCodeBlocks(addFigures(addHeadingIds(smartTypography(bodyHtml))))
}
