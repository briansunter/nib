import {
  parse,
  Tokenizer,
  TokenizerMode,
  type DefaultTreeAdapterTypes,
  type ParserError,
  type Token,
  type TokenHandler,
} from 'parse5'

export type HtmlDocumentNode = DefaultTreeAdapterTypes.Document
export type HtmlElementNode = DefaultTreeAdapterTypes.Element

export interface ParsedHtmlDocument {
  readonly document: HtmlDocumentNode
  readonly elements: readonly HtmlElementNode[]
  readonly parseErrors: readonly ParserError[]
}

export interface InspectedHtmlElement {
  readonly tagName: string
  readonly attrs: readonly {
    readonly name: string
    readonly value: string
  }[]
}

export interface ParsedInspectionDocument {
  readonly elements: readonly InspectedHtmlElement[]
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

/** Tokenizes inspection-relevant HTML without constructing a parent-linked DOM. */
export function parseInspectionDocument(html: string): ParsedInspectionDocument {
  const elements: InspectedHtmlElement[] = []
  const parseErrors: ParserError[] = []
  let tokenizer: Tokenizer
  const handler: TokenHandler = {
    onStartTag(token) {
      for (const attribute of token.attrs) Object.freeze(attribute)
      Object.freeze(token.attrs)
      elements.push(Object.freeze(token))
      if (token.tagName === 'script') tokenizer.state = TokenizerMode.SCRIPT_DATA
      else if (['style', 'xmp', 'iframe', 'noembed', 'noframes'].includes(token.tagName)) {
        tokenizer.state = TokenizerMode.RAWTEXT
      } else if (token.tagName === 'title' || token.tagName === 'textarea') {
        tokenizer.state = TokenizerMode.RCDATA
      } else if (token.tagName === 'plaintext') {
        tokenizer.state = TokenizerMode.PLAINTEXT
      }
    },
    onEndTag(_token: Token.TagToken) {},
    onComment(_token: Token.CommentToken) {},
    onDoctype(_token: Token.DoctypeToken) {},
    onEof(_token: Token.EOFToken) {},
    onCharacter(_token: Token.CharacterToken) {},
    onNullCharacter(_token: Token.CharacterToken) {},
    onWhitespaceCharacter(_token: Token.CharacterToken) {},
    onParseError(error) {
      parseErrors.push(Object.freeze(error))
    },
  }
  tokenizer = new Tokenizer({ sourceCodeLocationInfo: false }, handler)
  tokenizer.write(html, true)
  return Object.freeze({
    elements: Object.freeze(elements),
    parseErrors: Object.freeze(parseErrors),
  })
}

export function htmlAttribute(
  element: { readonly attrs: readonly { readonly name: string; readonly value: string }[] },
  name: string,
): string | undefined {
  return element.attrs.find((attribute) => attribute.name === name)?.value
}
