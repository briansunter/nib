import {
  codeToHast,
  createHighlighterCoreSync,
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
import { defineMarkdown } from '@briansunter/nib'
import rehypeFigure from '@microflash/rehype-figure'
import type { Element, Root } from 'hast'
import { retext } from 'retext'
import smartypants from 'retext-smartypants'
import { visit } from 'unist-util-visit'
import { rehypeHeadingIds } from './heading-ids'

const highlighter = createHighlighterCoreSync({
  themes: [githubDark],
  langs: [bash, json, python, rust, tsx, typescript, yaml],
  engine: createJavaScriptRegexEngine(),
})

const smartypantsProcessor = retext().use(smartypants, {
  ellipses: false,
  dashes: false,
  backticks: false,
})

const languageAliases: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  yml: 'yaml',
}

function textContent(node: Element): string {
  return node.children.map((child) => (
    child.type === 'text'
      ? child.value
      : child.type === 'element'
        ? textContent(child)
        : ''
  )).join('')
}

function smartTypographyNode(node: Root | Element, ignored = false): void {
  const nextIgnored = ignored || (
    node.type === 'element'
    && ['code', 'pre', 'script', 'style'].includes(node.tagName)
  )
  for (const child of node.children) {
    if (child.type === 'text' && !nextIgnored) {
      child.value = smartypantsProcessor.processSync(child.value).toString()
    } else if (child.type === 'element') {
      smartTypographyNode(child, nextIgnored)
    }
  }
}

export function rehypeProjectSmartTypography() {
  return (tree: Root) => smartTypographyNode(tree)
}

function copyButtonChildren(): Element[] {
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
      children: [{
        type: 'element',
        tagName: 'path',
        properties: {
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          d: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
        },
        children: [],
      }],
    },
    {
      type: 'element',
      tagName: 'span',
      properties: { className: ['copy-button-label'] },
      children: [{ type: 'text', value: 'Copy' }],
    },
  ]
}

export function rehypeProjectShiki() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index?: number, parent?: any) => {
      if (node.tagName !== 'pre' || index === undefined || !parent) return
      const code = node.children.find(
        (child): child is Element => child.type === 'element' && child.tagName === 'code',
      )
      if (!code) return
      const className = code.properties?.className
      const classes = Array.isArray(className) ? className.map(String) : [String(className ?? '')]
      const requested = classes
        .find((entry) => entry.startsWith('language-'))
        ?.slice('language-'.length) ?? 'plaintext'
      const normalized = languageAliases[requested.toLowerCase()] ?? requested.toLowerCase()
      const language = highlighter.getLoadedLanguages().includes(normalized)
        ? normalized
        : 'plaintext'
      const source = textContent(code).replace(/\n$/, '')
      const highlighted = codeToHast(highlighter, source, {
        lang: language,
        theme: 'github-dark',
      })
      const highlightedPre = highlighted.children.find(
        (child): child is Element => child.type === 'element' && child.tagName === 'pre',
      )
      if (!highlightedPre) return
      highlightedPre.properties = {
        ...highlightedPre.properties,
        class: 'astro-code github-dark',
        style: `${String(highlightedPre.properties?.style ?? '')}; overflow-x: auto;`,
        tabindex: '0',
        'data-language': requested,
      }
      parent.children[index] = {
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
                children: [{ type: 'text', value: requested }],
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
                children: copyButtonChildren(),
              },
            ],
          },
          highlightedPre,
        ],
      } satisfies Element
    })
  }
}

/** Project prose uses the shared Nib compiler with its source-compatible profile. */
export const projectMarkdown = defineMarkdown({
  allowDangerousHtml: true,
  rehypePlugins: [
    rehypeProjectSmartTypography,
    rehypeHeadingIds,
    rehypeFigure,
    rehypeProjectShiki,
  ],
})
