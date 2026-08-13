import type {
  HeadAttributeValue,
  HeadContribution,
  HeadElement,
  MetadataImage,
  ResolvedPageMeta,
} from './types'

const attributeName = /^[A-Za-z_:][A-Za-z0-9:._-]*$/

function isHeadTag(value: string): value is HeadElement['tag'] {
  return value === 'meta' || value === 'link' || value === 'script' || value === 'style'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeRawText(value: string): string {
  return value.replace(/<\/(script|style)/gi, '<\\/$1')
}

function normalizedAttributes(
  value: unknown,
  label: string,
): Readonly<Record<string, HeadAttributeValue>> | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error(`${label} attributes must be an object`)
  const attributes: Record<string, HeadAttributeValue> = {}
  for (const [name, attribute] of Object.entries(value)) {
    if (!attributeName.test(name) || name.toLowerCase().startsWith('on')) {
      throw new Error(`${label} has an unsafe attribute name: ${name}`)
    }
    if (
      typeof attribute !== 'string'
      && typeof attribute !== 'number'
      && typeof attribute !== 'boolean'
    ) {
      throw new Error(`${label} attribute ${name} must be a string, number, or boolean`)
    }
    if (typeof attribute === 'number' && !Number.isFinite(attribute)) {
      throw new Error(`${label} attribute ${name} must be finite`)
    }
    attributes[name] = attribute
  }
  return Object.freeze(attributes)
}

/** Validates and freezes structured document-head additions at the authoring seam. */
export function normalizeHeadContribution(
  value: unknown,
  label = 'Head contribution',
): HeadContribution | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  for (const field of ['title', 'description'] as const) {
    if (value[field] !== undefined && typeof value[field] !== 'string') {
      throw new Error(`${label}.${field} must be a string`)
    }
  }
  if (typeof value.title === 'string' && value.title.trim() === '') {
    throw new Error(`${label}.title must be a non-empty string`)
  }
  if (value.elements !== undefined && !Array.isArray(value.elements)) {
    throw new Error(`${label}.elements must be an array`)
  }
  const title = typeof value.title === 'string' ? value.title : undefined
  const description = typeof value.description === 'string' ? value.description : undefined

  const elements = (value.elements ?? []).map((element, index) => {
    const elementLabel = `${label}.elements[${index}]`
    if (!isRecord(element)) throw new Error(`${elementLabel} must be an object`)
    if (element.key !== undefined && typeof element.key !== 'string') {
      throw new Error(`${elementLabel}.key must be a string`)
    }
    const tag = element.tag
    if (typeof tag !== 'string' || !isHeadTag(tag)) {
      throw new Error(`${elementLabel}.tag must be meta, link, script, or style`)
    }
    if (element.content !== undefined && typeof element.content !== 'string') {
      throw new Error(`${elementLabel}.content must be a string`)
    }
    if ((tag === 'meta' || tag === 'link') && element.content !== undefined) {
      throw new Error(`${elementLabel} ${tag} elements cannot have content`)
    }
    const attributes = normalizedAttributes(element.attributes, elementLabel)
    if (tag === 'script' && attributes?.src !== undefined && element.content !== undefined) {
      throw new Error(`${elementLabel} script elements cannot have both src and content`)
    }
    return Object.freeze({
      ...(typeof element.key === 'string' ? { key: element.key } : {}),
      tag,
      ...(attributes === undefined ? {} : { attributes }),
      ...(element.content === undefined ? {} : { content: element.content }),
    })
  })

  return Object.freeze({
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description }),
    elements: Object.freeze(elements),
  })
}

function renderAttributes(
  attributes: Readonly<Record<string, HeadAttributeValue>> | undefined,
): string {
  return Object.entries(attributes ?? {})
    .filter(([, value]) => value !== false)
    .map(([name, value]) => value === true
      ? name
      : `${name}="${escapeHtml(String(value))}"`)
    .join(' ')
}

function renderElement(element: HeadElement): string {
  const attributes = renderAttributes(element.attributes)
  const opening = attributes === '' ? `<${element.tag}` : `<${element.tag} ${attributes}`
  if (element.tag === 'meta' || element.tag === 'link') return `${opening} />`
  return `${opening}>${escapeRawText(element.content ?? '')}</${element.tag}>`
}

export function resolveMeta(
  meta: unknown,
  label = 'Page metadata',
): ResolvedPageMeta {
  if (meta !== undefined && !isRecord(meta)) {
    throw new Error(`${label} must be an object`)
  }
  const value = isRecord(meta) ? meta : {}
  if (typeof value.title !== 'string' || value.title.trim() === '') {
    throw new Error(`${label} must define a non-empty title`)
  }
  if (value.description !== undefined && typeof value.description !== 'string') {
    throw new Error(`${label} description must be a string`)
  }
  if (value.draft !== undefined && typeof value.draft !== 'boolean') {
    throw new Error(`${label} draft must be a boolean`)
  }
  if (
    value.type !== undefined
    && value.type !== 'website'
    && value.type !== 'article'
  ) {
    throw new Error(`${label} type must be website or article`)
  }
  if (
    value.twitterCard !== undefined
    && value.twitterCard !== 'summary'
    && value.twitterCard !== 'summary_large_image'
  ) {
    throw new Error(`${label} twitterCard must be summary or summary_large_image`)
  }
  const pageHead = normalizeHeadContribution(value.head, `${label} head`)
  const image = normalizeMetadataImage(value.image, `${label} image`)
  return Object.freeze({
    title: value.title,
    ...(value.description === undefined ? {} : { description: value.description }),
    ...(value.draft === undefined ? {} : { draft: value.draft }),
    ...(pageHead === undefined ? {} : { head: pageHead }),
    ...(image === undefined ? {} : { image }),
    ...(value.type === undefined ? {} : { type: value.type }),
    ...(value.twitterCard === undefined ? {} : { twitterCard: value.twitterCard }),
  })
}

export function renderHead(
  meta: ResolvedPageMeta,
  additional?: HeadContribution,
): string {
  const pageHead = normalizeHeadContribution(meta.head, 'Page metadata head')
  const rendererHead = normalizeHeadContribution(additional, 'Renderer head contribution')
  const title = rendererHead?.title ?? pageHead?.title ?? meta.title
  const description = rendererHead?.description
    ?? pageHead?.description
    ?? meta.description
  const combined = [
    ...(pageHead?.elements ?? []),
    ...(rendererHead?.elements ?? []),
  ]
  const elements = dedupeKeyedElements(combined)
  return [
    `<title>${escapeHtml(title)}</title>`,
    ...(description === undefined
      ? []
      : [`<meta name="description" content="${escapeHtml(description)}" />`]),
    ...elements.map(renderElement),
  ].join('\n    ')
}

function dedupeKeyedElements(elements: readonly HeadElement[]): HeadElement[] {
  const out: HeadElement[] = []
  const keyIndex = new Map<string, number>()
  for (const element of elements) {
    if (element.key !== undefined) {
      const existing = keyIndex.get(element.key)
      if (existing !== undefined) { out[existing] = element; continue }
      keyIndex.set(element.key, out.length)
    }
    out.push(element)
  }
  return out
}

/** Validates a MetadataImage union (string or structured object). */
export function normalizeMetadataImage(value: unknown, label: string): MetadataImage | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'string') {
    if (value.trim() === '') throw new Error(`${label} must be a non-empty string`)
    return value
  }
  if (!isRecord(value)) throw new Error(`${label} must be a string or an object`)
  const { src } = value
  if (typeof src !== 'string' || src.trim() === '') {
    throw new Error(`${label}.src must be a non-empty string`)
  }
  const result: {
    src: string
    alt?: string
    width?: number
    height?: number
    type?: string
  } = { src }
  if (value.alt !== undefined) {
    if (typeof value.alt !== 'string') throw new Error(`${label}.alt must be a string`)
    result.alt = value.alt
  }
  if (value.width !== undefined) {
    if (
      typeof value.width !== 'number'
      || !Number.isSafeInteger(value.width)
      || value.width <= 0
    ) {
      throw new Error(`${label}.width must be a positive safe integer`)
    }
    result.width = value.width
  }
  if (value.height !== undefined) {
    if (
      typeof value.height !== 'number'
      || !Number.isSafeInteger(value.height)
      || value.height <= 0
    ) {
      throw new Error(`${label}.height must be a positive safe integer`)
    }
    result.height = value.height
  }
  if (value.type !== undefined) {
    if (typeof value.type !== 'string') throw new Error(`${label}.type must be a string`)
    result.type = value.type
  }
  return Object.freeze(result)
}

/** Reads the URL of a MetadataImage value regardless of which form it takes. */
export function metadataImageSrc(image: MetadataImage | undefined): string | undefined {
  if (image === undefined) return undefined
  if (typeof image === 'string') return image
  return image.src
}
