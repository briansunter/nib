import type {
  HeadAttributeValue,
  HeadContribution,
  HeadElement,
  PageMeta,
  SiteConfig,
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
  if (value.elements === undefined) return Object.freeze({ elements: Object.freeze([]) })
  if (!Array.isArray(value.elements)) throw new Error(`${label}.elements must be an array`)

  const elements = value.elements.map((element, index) => {
    const elementLabel = `${label}.elements[${index}]`
    if (!isRecord(element)) throw new Error(`${elementLabel} must be an object`)
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
      tag,
      ...(attributes === undefined ? {} : { attributes }),
      ...(element.content === undefined ? {} : { content: element.content }),
    })
  })

  return Object.freeze({ elements: Object.freeze(elements) })
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

export function resolveMeta(meta: PageMeta | undefined, site: SiteConfig) {
  normalizeHeadContribution(site.head, 'Nib site.head')
  const pageHead = normalizeHeadContribution(meta?.head, 'Page metadata head')
  const rawTitle = meta?.title ?? site.title
  const title = meta?.title && site.titleTemplate
    ? site.titleTemplate.replace('%s', meta.title)
    : rawTitle

  return {
    ...meta,
    ...(pageHead === undefined ? {} : { head: pageHead }),
    title,
    description: meta?.description ?? site.description ?? ''
  }
}

export function renderHead(
  meta: ReturnType<typeof resolveMeta>,
  site?: Pick<SiteConfig, 'head'>,
  additional?: HeadContribution,
): string {
  const elements = [
    ...(normalizeHeadContribution(site?.head, 'Nib site.head')?.elements ?? []),
    ...(normalizeHeadContribution(meta.head, 'Page metadata head')?.elements ?? []),
    ...(normalizeHeadContribution(additional, 'Renderer head contribution')?.elements ?? []),
  ]
  return [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    ...elements.map(renderElement),
  ].join('\n    ')
}
