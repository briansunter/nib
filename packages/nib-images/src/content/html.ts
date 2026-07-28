import { parse, type DefaultTreeAdapterTypes } from 'parse5'

export interface HtmlAttributes {
  readonly [name: string]: string
}

export interface ParsedHtmlAttribute {
  readonly name: string
  readonly localName: string
  readonly value: string
  readonly startOffset: number
  readonly endOffset: number
}

export interface ParsedHtmlElement {
  readonly tagName: string
  readonly attributes: readonly ParsedHtmlAttribute[]
  readonly startOffset: number
  readonly startTagEndOffset: number
  readonly endOffset: number
}

export interface TextReplacement {
  readonly startOffset: number
  readonly endOffset: number
  readonly value: string
}

function elementChildren(
  node: DefaultTreeAdapterTypes.Node,
): readonly DefaultTreeAdapterTypes.ChildNode[] {
  if (!('childNodes' in node)) return []
  if ('tagName' in node && node.tagName === 'template' && 'content' in node) {
    return [...node.childNodes, ...node.content.childNodes]
  }
  return node.childNodes
}

/** Inspects only real HTML elements while retaining exact source ranges. */
export function parseHtmlElements(html: string): readonly ParsedHtmlElement[] {
  const document = parse(html, { sourceCodeLocationInfo: true })
  const elements: ParsedHtmlElement[] = []
  const visit = (node: DefaultTreeAdapterTypes.Node): void => {
    if ('tagName' in node) {
      const location = node.sourceCodeLocation
      const startTag = location?.startTag ?? location
      if (location && startTag) {
        const attributes = node.attrs.flatMap((attribute): ParsedHtmlAttribute[] => {
          const name = attribute.prefix === undefined
            ? attribute.name
            : `${attribute.prefix}:${attribute.name}`
          const attributeLocation = location.attrs?.[name]
          if (!attributeLocation) return []
          return [{
            name,
            localName: attribute.name,
            value: attribute.value,
            startOffset: attributeLocation.startOffset,
            endOffset: attributeLocation.endOffset,
          }]
        })
        elements.push({
          tagName: node.tagName,
          attributes,
          startOffset: startTag.startOffset,
          startTagEndOffset: startTag.endOffset,
          endOffset: location.endOffset,
        })
      }
    }
    for (const child of elementChildren(node)) visit(child)
  }
  visit(document)
  return elements
}

export function attributesFor(element: ParsedHtmlElement): HtmlAttributes {
  const attributes: Record<string, string> = {}
  for (const attribute of element.attributes) {
    if (!(attribute.localName in attributes)) attributes[attribute.localName] = attribute.value
  }
  return attributes
}

export function applyTextReplacements(
  value: string,
  replacements: readonly TextReplacement[],
): string {
  if (replacements.length === 0) return value
  let output = value
  let nextOffset = value.length
  for (const replacement of [...replacements].sort(
    (left, right) => right.startOffset - left.startOffset,
  )) {
    if (
      replacement.startOffset < 0
      || replacement.endOffset < replacement.startOffset
      || replacement.endOffset > nextOffset
    ) {
      throw new Error('@briansunter/nib-images: overlapping or invalid HTML rewrite')
    }
    output = `${output.slice(0, replacement.startOffset)}${replacement.value}${output.slice(replacement.endOffset)}`
    nextOffset = replacement.startOffset
  }
  return output
}
