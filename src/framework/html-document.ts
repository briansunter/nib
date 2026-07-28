import { parse, type DefaultTreeAdapterTypes, type ParserError } from 'parse5'

export type HtmlDocumentNode = DefaultTreeAdapterTypes.Document
export type HtmlElementNode = DefaultTreeAdapterTypes.Element

export interface ParsedHtmlDocument {
  readonly document: HtmlDocumentNode
  readonly elements: readonly HtmlElementNode[]
  readonly parseErrors: readonly ParserError[]
}

function isElement(node: DefaultTreeAdapterTypes.Node): node is HtmlElementNode {
  return 'tagName' in node
}

function childNodes(node: DefaultTreeAdapterTypes.Node): readonly DefaultTreeAdapterTypes.ChildNode[] {
  if (!('childNodes' in node)) return []
  const children = [...node.childNodes]
  if (isElement(node) && node.tagName === 'template' && 'content' in node) {
    children.push(...node.content.childNodes)
  }
  return children
}

function freezeTree(
  value: object,
  visited: WeakSet<object>,
): void {
  if (visited.has(value)) return
  visited.add(value)
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') freezeTree(child as object, visited)
  }
  Object.freeze(value)
}

/** Parses HTML once and freezes the shared server-only representation. */
export function parseHtmlDocument(html: string): ParsedHtmlDocument {
  const parseErrors: ParserError[] = []
  const document = parse(html, {
    onParseError(error) {
      parseErrors.push(error)
    },
  })
  const elements: HtmlElementNode[] = []
  const visit = (node: DefaultTreeAdapterTypes.Node): void => {
    if (isElement(node)) elements.push(node)
    for (const child of childNodes(node)) visit(child)
  }
  visit(document)
  freezeTree(document, new WeakSet())
  return Object.freeze({
    document,
    elements: Object.freeze(elements),
    parseErrors: Object.freeze(parseErrors.map((error) => Object.freeze(error))),
  })
}

export function htmlAttribute(
  element: HtmlElementNode,
  name: string,
): string | undefined {
  return element.attrs.find((attribute) => attribute.name === name)?.value
}
