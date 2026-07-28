import type { DefaultTreeAdapterTypes } from 'parse5'
import {
  htmlAttribute,
  parseHtmlDocument,
  type HtmlDocumentNode,
  type HtmlElementNode,
  type ParsedHtmlDocument,
} from './html-document'

export type SemanticTextNormalizer = 'nib-semantic-v1' | 'nib-typography-v1'
export type SemanticRoot = HtmlDocumentNode | HtmlElementNode

export interface SemanticTraversalOptions {
  readonly pagefindAware?: boolean
}

export interface SemanticRootSelector {
  readonly tagName?: string
  readonly id?: string
  readonly className?: string
  readonly attribute?: string
}

export interface SemanticHeading {
  readonly level: number
  readonly id: string
  readonly text: string
}

export interface SemanticDate {
  readonly datetime: string
  readonly text: string
}

export interface SemanticLink {
  readonly href: string
  readonly text: string
}

export interface SemanticSnapshotOptions extends SemanticTraversalOptions {
  readonly normalizer?: SemanticTextNormalizer
  readonly root?: SemanticRootSelector
  readonly fallbackRoot?: SemanticRootSelector
  readonly siteOrigin?: string
  readonly structuralTags?: readonly string[]
  readonly normalizeHref?: (href: string) => string
}

export type SemanticSnapshotRootOptions = Omit<
  SemanticSnapshotOptions,
  'root' | 'fallbackRoot'
>

export interface SemanticHtmlSnapshot {
  readonly version: 1
  readonly normalizer: SemanticTextNormalizer
  readonly rootCount: number
  readonly text: string
  readonly headings: readonly SemanticHeading[]
  readonly dates: readonly SemanticDate[]
  readonly links: readonly SemanticLink[]
  readonly structures: Readonly<Record<string, number>>
}

export interface SemanticDifference {
  readonly field: keyof Omit<SemanticHtmlSnapshot, 'version' | 'normalizer'>
  readonly source: unknown
  readonly target: unknown
}

export interface SemanticHtmlComparison {
  readonly version: 1
  readonly normalizer: SemanticTextNormalizer
  readonly equal: boolean
  readonly differences: readonly SemanticDifference[]
  readonly source: SemanticHtmlSnapshot
  readonly target: SemanticHtmlSnapshot
}

const BLOCK_ELEMENTS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'br',
  'dd',
  'details',
  'dialog',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
])
const IGNORED_TEXT_ELEMENTS = new Set([
  'script',
  'style',
  'svg',
  'template',
  'noscript',
])
const DEFAULT_STRUCTURAL_TAGS = Object.freeze([
  'figure',
  'figcaption',
  'code',
  'pre',
  'iframe',
  'table',
])

function childNodes(
  node: DefaultTreeAdapterTypes.Node,
): readonly DefaultTreeAdapterTypes.ChildNode[] {
  if (!('childNodes' in node)) return []
  const children = [...node.childNodes]
  if ('tagName' in node && node.tagName === 'template' && 'content' in node) {
    children.push(...node.content.childNodes)
  }
  return children
}

function isElement(node: DefaultTreeAdapterTypes.Node): node is HtmlElementNode {
  return 'tagName' in node
}

function isText(node: DefaultTreeAdapterTypes.Node): node is DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === '#text'
}

export function semanticDocument(html: string): ParsedHtmlDocument {
  return parseHtmlDocument(html)
}

export function semanticAttribute(
  node: HtmlElementNode,
  name: string,
): string | undefined {
  return htmlAttribute(node, name)
}

export function semanticHasClass(
  node: HtmlElementNode,
  className: string,
): boolean {
  return (semanticAttribute(node, 'class') ?? '').split(/\s+/).includes(className)
}

function ignored(
  node: HtmlElementNode,
  options: SemanticTraversalOptions,
): boolean {
  if (IGNORED_TEXT_ELEMENTS.has(node.tagName)) return true
  if (semanticAttribute(node, 'hidden') !== undefined) return true
  if ((semanticAttribute(node, 'aria-hidden') ?? '').toLowerCase() === 'true') return true
  if (/display\s*:\s*none/i.test(semanticAttribute(node, 'style') ?? '')) return true
  return options.pagefindAware === true
    && semanticAttribute(node, 'data-pagefind-ignore') !== undefined
}

export function semanticElements(
  roots: SemanticRoot | readonly SemanticRoot[],
  predicate: (element: HtmlElementNode) => boolean,
  options: SemanticTraversalOptions = {},
): readonly HtmlElementNode[] {
  const matches: HtmlElementNode[] = []
  const visit = (node: DefaultTreeAdapterTypes.Node, ignoredAncestor: boolean): void => {
    const isIgnored = ignoredAncestor || (isElement(node) && ignored(node, options))
    if (isIgnored) return
    if (isElement(node) && predicate(node)) matches.push(node)
    for (const child of childNodes(node)) visit(child, isIgnored)
  }
  for (const root of Array.isArray(roots) ? roots : [roots]) visit(root, false)
  return Object.freeze(matches)
}

function classes(node: HtmlElementNode): readonly string[] {
  return (semanticAttribute(node, 'class') ?? '').split(/\s+/).filter(Boolean)
}

function createsBoundary(node: HtmlElementNode): boolean {
  if (BLOCK_ELEMENTS.has(node.tagName)) return true
  return classes(node).some((className) => (
    ['block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'list-item', 'table'].includes(className)
  ))
}

function separatesChildren(node: HtmlElementNode): boolean {
  return classes(node).some((className) => (
    ['flex', 'inline-flex', 'grid', 'inline-grid', 'contents', 'segmented-control'].includes(className)
    || /^(?:gap|gap-[xy]|space-[xy])-/.test(className)
  ))
}

function visibleText(
  node: DefaultTreeAdapterTypes.Node,
  options: SemanticTraversalOptions,
  ignoredAncestor = false,
): boolean {
  if (isText(node)) return !ignoredAncestor && /\S/.test(node.value)
  const isIgnored = ignoredAncestor || (isElement(node) && ignored(node, options))
  return !isIgnored && childNodes(node).some((child) => visibleText(child, options, isIgnored))
}

export function normalizeSemanticText(
  value: string,
  normalizer: SemanticTextNormalizer = 'nib-semantic-v1',
): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?%°)\]}])/g, '$1')
    .replace(/([(\[{])\s+/g, '$1')
    .trim()
  if (normalizer === 'nib-typography-v1') return normalized
  return normalized
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
}

export function semanticTextContent(
  roots: SemanticRoot | readonly SemanticRoot[],
  options: SemanticTraversalOptions & {
    readonly normalizer?: SemanticTextNormalizer
  } = {},
): string {
  const parts: string[] = []
  const collect = (node: DefaultTreeAdapterTypes.Node, ignoredAncestor: boolean): void => {
    if (isText(node)) {
      if (!ignoredAncestor) parts.push(node.value)
      return
    }
    const isIgnored = ignoredAncestor || (isElement(node) && ignored(node, options))
    if (isIgnored) return
    const boundary = isElement(node) && createsBoundary(node)
    const separated = isElement(node) && separatesChildren(node)
    if (boundary) parts.push(' ')
    const children = childNodes(node)
    children.forEach((child, index) => {
      if (separated && index > 0) parts.push(' ')
      if (
        isElement(child)
        && ignored(child, options)
        && children.slice(0, index).some((sibling) => visibleText(sibling, options))
        && children.slice(index + 1).some((sibling) => visibleText(sibling, options))
      ) {
        parts.push(' ')
      }
      collect(child, isIgnored)
    })
    if (boundary) parts.push(' ')
  }
  for (const root of Array.isArray(roots) ? roots : [roots]) {
    collect(root, false)
    parts.push(' ')
  }
  return normalizeSemanticText(parts.join(''), options.normalizer)
}

function matchesSelector(
  element: HtmlElementNode,
  selector: SemanticRootSelector,
): boolean {
  return (selector.tagName === undefined || element.tagName === selector.tagName)
    && (selector.id === undefined || semanticAttribute(element, 'id') === selector.id)
    && (selector.className === undefined || semanticHasClass(element, selector.className))
    && (selector.attribute === undefined || semanticAttribute(element, selector.attribute) !== undefined)
}

export function semanticRoots(
  document: ParsedHtmlDocument,
  selector: SemanticRootSelector,
): readonly HtmlElementNode[] {
  return semanticElements(document.document, (element) => matchesSelector(element, selector))
}

function normalizedHref(
  value: string,
  options: SemanticSnapshotOptions,
): string {
  if (options.normalizeHref) return options.normalizeHref(value)
  const href = value.trim()
  if (!href) return ''
  let result = href
  if (options.siteOrigin) {
    try {
      const parsed = new URL(href, options.siteOrigin)
      if (parsed.origin === new URL(options.siteOrigin).origin) {
        result = `${parsed.pathname}${parsed.search}${parsed.hash}`
      }
    } catch {
      result = href
    }
  }
  return result.length > 1 && result.endsWith('/') ? result.slice(0, -1) : result
}

function snapshotRoots(
  document: ParsedHtmlDocument,
  options: SemanticSnapshotOptions,
): readonly HtmlElementNode[] {
  const primary = options.root ?? { id: 'main-content' }
  const roots = semanticRoots(document, primary)
  if (roots.length > 0 || options.root !== undefined && options.fallbackRoot === undefined) {
    return roots
  }
  return semanticRoots(document, options.fallbackRoot ?? { tagName: 'main' })
}

export function semanticHtmlSnapshot(
  html: string,
  options: SemanticSnapshotOptions = {},
): SemanticHtmlSnapshot {
  const document = semanticDocument(html)
  const roots = snapshotRoots(document, options)
  return semanticSnapshot(roots, options)
}

/** Creates one versioned snapshot from already parsed semantic roots. */
export function semanticSnapshot(
  roots: SemanticRoot | readonly SemanticRoot[],
  options: SemanticSnapshotRootOptions = {},
): SemanticHtmlSnapshot {
  const rootCount = Array.isArray(roots)
    ? (roots as readonly SemanticRoot[]).length
    : 1
  const normalizer = options.normalizer ?? 'nib-semantic-v1'
  const traversal: SemanticTraversalOptions = options.pagefindAware === undefined
    ? {}
    : { pagefindAware: options.pagefindAware }
  const headings = semanticElements(roots, (element) => /^h[1-6]$/.test(element.tagName), traversal)
    .map((element) => Object.freeze({
      level: Number(element.tagName.slice(1)),
      id: semanticAttribute(element, 'id') ?? '',
      text: semanticTextContent(element, { ...traversal, normalizer }),
    }))
  const dates = semanticElements(roots, (element) => element.tagName === 'time', traversal)
    .map((element) => Object.freeze({
      datetime: semanticAttribute(element, 'datetime') ?? '',
      text: semanticTextContent(element, { ...traversal, normalizer }),
    }))
  const links = semanticElements(
    roots,
    (element) => element.tagName === 'a' && semanticAttribute(element, 'href') !== undefined,
    traversal,
  ).map((element) => Object.freeze({
    href: normalizedHref(semanticAttribute(element, 'href') ?? '', options),
    text: semanticTextContent(element, { ...traversal, normalizer }),
  }))
  const structures = Object.fromEntries(
    (options.structuralTags ?? DEFAULT_STRUCTURAL_TAGS).map((tagName) => [
      tagName,
      semanticElements(roots, (element) => element.tagName === tagName, traversal).length,
    ]),
  )
  return Object.freeze({
    version: 1,
    normalizer,
    rootCount,
    text: semanticTextContent(roots, { ...traversal, normalizer }),
    headings: Object.freeze(headings),
    dates: Object.freeze(dates),
    links: Object.freeze(links),
    structures: Object.freeze(structures),
  })
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function compareSemanticHtml(
  sourceHtml: string,
  targetHtml: string,
  options: SemanticSnapshotOptions = {},
): SemanticHtmlComparison {
  const source = semanticHtmlSnapshot(sourceHtml, options)
  const target = semanticHtmlSnapshot(targetHtml, options)
  const fields = ['rootCount', 'text', 'headings', 'dates', 'links', 'structures'] as const
  const differences = fields.flatMap((field): SemanticDifference[] => (
    sameValue(source[field], target[field])
      ? []
      : [Object.freeze({ field, source: source[field], target: target[field] })]
  ))
  return Object.freeze({
    version: 1,
    normalizer: source.normalizer,
    equal: differences.length === 0,
    differences: Object.freeze(differences),
    source,
    target,
  })
}

export function semanticDirectChildTags(
  roots: SemanticRoot | readonly SemanticRoot[],
  selector: SemanticRootSelector,
  options: SemanticTraversalOptions = {},
): readonly (readonly string[])[] {
  return Object.freeze(
    semanticElements(roots, (element) => matchesSelector(element, selector), options)
      .map((element) => Object.freeze(
        childNodes(element)
          .filter((child): child is HtmlElementNode => isElement(child) && !ignored(child, options))
          .map((child) => child.tagName),
      )),
  )
}
