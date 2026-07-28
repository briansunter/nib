import fs from 'node:fs/promises'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Image } from '../image-component'
import { ImageRegistryProvider } from '../image-context'
import type { ImageBuildRegistry } from '../image-registry'
import type { ContentImageFallback } from '../image-registry'
import { ImageSourceCatalog } from '../image-source-catalog'
import type { ImageProps } from '../image-component'
import type { NormalizedContentImageSource, NormalizedImagesOptions } from '../options'
import {
  applyTextReplacements,
  attributesFor,
  parseHtmlElements,
  srcsetUrls,
  type HtmlAttributes,
  type ParsedHtmlAttribute,
  type ParsedHtmlElement,
  type TextReplacement,
} from './html'

interface PublicationRoute {
  readonly kind: string
  readonly artifact: string
  readonly contentType: string
}

function localContentUrl(value: string): URL | undefined {
  const authored = value.trim()
  if (
    authored === ''
    || /^[A-Za-z][A-Za-z\d+.-]*:/.test(authored)
    || authored.startsWith('//')
  ) {
    return undefined
  }
  try {
    const parsed = new URL(authored, 'http://nib.local')
    return parsed.origin === 'http://nib.local' ? parsed : undefined
  } catch {
    return undefined
  }
}

function outputPrefix(clientDirectory: string, publicPath: string): string {
  const output = path.resolve(clientDirectory, publicPath.replace(/^\/+/, ''))
  const relative = path.relative(clientDirectory, output)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`@briansunter/nib-images: content publicPath escapes client output: ${publicPath}`)
  }
  return output
}

function publicContentUrl(src: string, base: string): string {
  const parsed = localContentUrl(src)
  if (parsed === undefined) {
    throw new Error(`@briansunter/nib-images: content URL must be local: ${src}`)
  }
  const normalizedBase = base === '/' ? '/' : `/${base.replace(/^\/+|\/+$/g, '')}/`
  const basePrefix = normalizedBase.replace(/\/$/, '')
  const pathname = basePrefix !== ''
    && (parsed.pathname === basePrefix || parsed.pathname.startsWith(`${basePrefix}/`))
    ? parsed.pathname
    : `${normalizedBase}${parsed.pathname.replace(/^\/+/, '')}`
  return `${pathname}${parsed.search}${parsed.hash}`
}

function sourceForUrl(
  src: string,
  base: string,
  options: NormalizedImagesOptions,
): { source: NormalizedContentImageSource; file: string } | undefined {
  for (const source of options.content) {
    const file = relativeSourceFile(src, source, base)
    if (file !== undefined) return { source, file }
  }
  return undefined
}

async function copyContentSource(
  clientDirectory: string,
  source: NormalizedContentImageSource,
  sourceFile: string,
): Promise<void> {
  const [sourceRoot, resolvedSource] = await Promise.all([
    fs.realpath(source.directory),
    fs.realpath(sourceFile),
  ])
  const relative = path.relative(sourceRoot, resolvedSource)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`@briansunter/nib-images: content source escapes its configured directory: ${sourceFile}`)
  }
  const target = path.join(outputPrefix(clientDirectory, source.publicPath), relative)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.copyFile(resolvedSource, target)
}

async function copyReferencedContentSources(
  clientDirectory: string,
  base: string,
  options: NormalizedImagesOptions,
  files: readonly string[],
): Promise<void> {
  const references = new Set<string>()
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8')
    for (const element of parseHtmlElements(html)) {
      for (const attribute of element.attributes) {
        if (attribute.localName === 'srcset' || attribute.localName === 'imagesrcset') {
          for (const candidate of srcsetUrls(attribute.value)) references.add(candidate.value)
          continue
        }
        if (
          (attribute.localName === 'src' || attribute.localName === 'href')
          && attribute.value !== ''
        ) {
          references.add(attribute.value)
        }
      }
    }
  }
  const copies = new Map<string, Promise<void>>()
  for (const reference of references) {
    const match = sourceForUrl(reference, base, options)
    if (match === undefined) continue
    const relative = path.relative(match.source.directory, match.file)
    const target = path.join(outputPrefix(clientDirectory, match.source.publicPath), relative)
    if (!copies.has(target)) {
      copies.set(target, copyContentSource(clientDirectory, match.source, match.file))
    }
  }
  await Promise.all(copies.values())
}

function htmlFiles(
  clientDirectory: string,
  routes: readonly PublicationRoute[],
): string[] {
  return routes.flatMap((route) => {
    if (route.kind !== 'page' || !route.contentType.startsWith('text/html')) return []
    const file = path.resolve(clientDirectory, route.artifact)
    const relative = path.relative(clientDirectory, file)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`@briansunter/nib-images: publication artifact escapes client output: ${route.artifact}`)
    }
    return [file]
  })
}

function relativeSourceFile(
  src: string,
  source: NormalizedContentImageSource,
  base: string,
): string | undefined {
  const parsed = localContentUrl(src)
  if (parsed === undefined) return undefined
  const pathname = parsed.pathname
  const prefixes = [...new Set([
    source.publicPath,
    `${base}${source.publicPath.replace(/^\/+/, '')}`,
  ])]
  const prefix = prefixes.find((candidate) => pathname.startsWith(candidate))
  if (!prefix) return undefined
  let relative: string
  try {
    relative = decodeURIComponent(pathname.slice(prefix.length))
  } catch {
    return undefined
  }
  if (relative === '' || relative.split('/').includes('..')) return undefined
  return path.join(source.directory, relative)
}

function reactAttributes(input: HtmlAttributes): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [name, value] of Object.entries(input)) {
    if (
      ['src', 'alt', 'srcset', 'sizes', 'width', 'height', 'loading', 'decoding', 'fetchpriority', 'style', 'data-nib-width', 'data-nib-widths']
        .includes(name)
    ) continue
    const reactName = name === 'class' ? 'className' : name === 'referrerpolicy' ? 'referrerPolicy' : name
    result[reactName] = value
  }
  return result
}

function mergeAuthoredStyle(markup: string, authoredStyle: string | undefined): string {
  if (authoredStyle === undefined || authoredStyle.trim() === '') return markup
  const image = parseHtmlElements(markup).find((element) => element.tagName === 'img')
  const style = image?.attributes.find((attribute) => attribute.localName === 'style')
  if (style === undefined) return markup
  const generated = style.value.trim()
  const separator = generated === '' || generated.endsWith(';') ? '' : ';'
  return applyTextReplacements(markup, [
    replaceAttributeValue(markup, style, `${generated}${separator}${authoredStyle.trim()}`),
  ])
}

/** Parses and validates a per-use `data-nib-widths` ladder (e.g. "480, 800, 1200"). */
function parseAuthoredWidths(value: string | undefined): readonly number[] | undefined {
  if (value === undefined || value === '') return undefined
  const parts = value.split(',').map((part) => part.trim()).filter((part) => part !== '')
  if (parts.length === 0) {
    throw new Error('@briansunter/nib-images: data-nib-widths must list positive integers')
  }
  const widths = parts.map((part) => {
    const parsed = Number(part)
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new Error(`@briansunter/nib-images: data-nib-widths must contain positive integers (got "${part}")`)
    }
    return parsed
  })
  return [...new Set(widths)].sort((left, right) => left - right)
}

/** Parses a per-use display width without accepting CSS units or fractions. */
function parseAuthoredWidth(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const parsed = Number(value.trim())
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`@briansunter/nib-images: data-nib-width must be a positive integer (got "${value}")`)
  }
  return parsed
}

function replaceAttributeValue(
  html: string,
  attribute: ParsedHtmlAttribute,
  value: string,
): TextReplacement {
  const authored = html.slice(attribute.startOffset, attribute.endOffset)
  const equals = authored.indexOf('=')
  if (equals < 0) {
    throw new Error(`@briansunter/nib-images: ${attribute.name} unexpectedly has no value`)
  }
  let valueStart = equals + 1
  while (/\s/.test(authored[valueStart] ?? '')) valueStart += 1
  const quote = authored[valueStart]
  if (quote === '"' || quote === "'") {
    return {
      startOffset: attribute.startOffset,
      endOffset: attribute.endOffset,
      value: `${authored.slice(0, valueStart + 1)}${escapeAttribute(value, quote)}${quote}`,
    }
  }
  return {
    startOffset: attribute.startOffset,
    endOffset: attribute.endOffset,
    value: `${authored.slice(0, valueStart)}"${escapeAttribute(value)}"`,
  }
}

function normalizeContentReferences(
  html: string,
  base: string,
  options: NormalizedImagesOptions,
): string {
  const replacements: TextReplacement[] = []
  for (const element of parseHtmlElements(html)) {
    for (const attribute of element.attributes) {
      if (attribute.localName === 'srcset' || attribute.localName === 'imagesrcset') {
        const candidates = srcsetUrls(attribute.value).flatMap((candidate): TextReplacement[] => {
          if (sourceForUrl(candidate.value, base, options) === undefined) return []
          return [{
            startOffset: candidate.start,
            endOffset: candidate.end,
            value: publicContentUrl(candidate.value, base),
          }]
        })
        if (candidates.length > 0) {
          replacements.push(replaceAttributeValue(
            html,
            attribute,
            applyTextReplacements(attribute.value, candidates),
          ))
        }
        continue
      }
      if (attribute.localName !== 'src' && attribute.localName !== 'href') continue
      if (sourceForUrl(attribute.value, base, options) === undefined) continue
      replacements.push(replaceAttributeValue(
        html,
        attribute,
        publicContentUrl(attribute.value, base),
      ))
    }
  }
  return applyTextReplacements(html, replacements)
}

async function rewriteFile(
  file: string,
  clientDirectory: string,
  base: string,
  options: NormalizedImagesOptions,
  registry: ImageBuildRegistry,
  catalog: ImageSourceCatalog,
  sourceCache: Map<string, Awaited<ReturnType<ImageSourceCatalog['load']>>>,
): Promise<number> {
  const html = await fs.readFile(file, 'utf8')
  const normalizedHtml = normalizeContentReferences(html, base, options)
  let replacements = 0
  const imageReplacements: TextReplacement[] = []
  const elements = parseHtmlElements(normalizedHtml)
  const pictures = elements.filter((element) => element.tagName === 'picture')
  for (const element of elements) {
    if (element.tagName !== 'img') continue
    if (pictures.some((picture) => (
      picture.startOffset < element.startOffset
      && element.endOffset <= picture.endOffset
    ))) continue
    const input = attributesFor(element)
    const src = input.src
    if (!src) continue
    const match = sourceForUrl(src, base, options)
    if (!match) continue
    const { source: sourceDefinition, file: sourceFile } = match
    let source = sourceCache.get(sourceFile)
    try {
      await copyContentSource(clientDirectory, sourceDefinition, sourceFile)
      if (!source) {
        source = await catalog.load(sourceFile)
        sourceCache.set(sourceFile, source)
      }
      const fallback: ContentImageFallback = {
        sourceFile,
        publicUrl: publicContentUrl(src, base),
      }
      registry.registerContentFallback(source, fallback)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(`nib-images: preserving ${src} after source inspection failure: ${detail}`)
      continue
    }
    const authoredFetchPriority = input.fetchpriority?.toLowerCase()
    const fetchPriority = (
      authoredFetchPriority === 'high'
      || authoredFetchPriority === 'low'
      || authoredFetchPriority === 'auto'
    ) ? authoredFetchPriority : undefined
    const highPriority = fetchPriority === 'high'
    const loading = input.loading === 'lazy' || input.loading === 'eager' ? input.loading : undefined
    let authoredWidth: number | undefined
    let authoredWidths: readonly number[] | undefined
    try {
      authoredWidth = parseAuthoredWidth(input['data-nib-width'])
      authoredWidths = parseAuthoredWidths(input['data-nib-widths'])
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(`nib-images: ${detail}; preserving ${src}`)
      continue
    }
    const authoredMaximum = authoredWidths?.at(-1)
    // Before data-nib-width existed, the largest authored candidate also
    // served as the intrinsic layout width. Preserve that behavior for
    // existing sites, while allowing a smaller display width with a useful
    // 2x responsive ladder for new content-image call sites.
    const requestedDisplayWidth = authoredWidth ?? authoredMaximum
    const configuredWidth = Math.min(
      source.width,
      ...(sourceDefinition.maxWidth === undefined ? [] : [sourceDefinition.maxWidth]),
      ...(requestedDisplayWidth === undefined ? [] : [requestedDisplayWidth]),
    )
    const requestedHardMaximum = authoredWidth === undefined
      ? configuredWidth
      : authoredMaximum === undefined
        ? undefined
        : Math.max(authoredMaximum, configuredWidth)
    const hardMaximum = sourceDefinition.maxWidth === undefined
      ? requestedHardMaximum
      : requestedHardMaximum === undefined
        ? sourceDefinition.maxWidth
        : Math.min(sourceDefinition.maxWidth, requestedHardMaximum)
    const authoredSizes = input.sizes === undefined || input.sizes === ''
      ? sourceDefinition.sizes
      : input.sizes
    const widths = authoredWidths ?? sourceDefinition.widths
    const props = {
      ...reactAttributes(input),
      src: source,
      alt: input.alt ?? '',
      layout: 'constrained' as const,
      width: configuredWidth,
      ...(hardMaximum === undefined ? {} : { maxWidth: Math.min(source.width, hardMaximum) }),
      ...(widths === undefined ? {} : { widths }),
      ...(authoredSizes === undefined ? {} : { sizes: authoredSizes }),
      ...(highPriority
        ? { priority: true as const }
        : {
            ...(loading === undefined ? {} : { loading }),
            ...(fetchPriority === undefined ? {} : { fetchPriority }),
          }),
    } as ImageProps
    replacements += 1
    const optimized = renderToStaticMarkup(createElement(
      ImageRegistryProvider,
      { registry, children: createElement(Image, props) },
    ))
    imageReplacements.push({
      startOffset: element.startOffset,
      endOffset: element.startTagEndOffset,
      value: mergeAuthoredStyle(optimized, input.style),
    })
  }
  const rewritten = applyTextReplacements(normalizedHtml, imageReplacements)
  if (rewritten !== html) await fs.writeFile(file, rewritten)
  return replacements
}

/** Optimizes only image URLs actually present in rendered HTML. */
export async function optimizeContentImages(
  clientDirectory: string,
  base: string,
  options: NormalizedImagesOptions,
  registry: ImageBuildRegistry,
  routes: readonly PublicationRoute[],
): Promise<number> {
  if (options.content.length === 0) return 0
  const catalog = new ImageSourceCatalog(options)
  const sourceCache = new Map<string, Awaited<ReturnType<ImageSourceCatalog['load']>>>()
  const files = htmlFiles(clientDirectory, routes)
  await copyReferencedContentSources(clientDirectory, base, options, files)
  let replacements = 0
  for (const file of files) {
    replacements += await rewriteFile(file, clientDirectory, base, options, registry, catalog, sourceCache)
  }
  if (replacements > 0) console.info(`nib-images: optimized ${replacements} content image reference(s)`)
  return replacements
}

function escapeAttribute(value: string, quote: '"' | "'" = '"'): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll(quote, quote === '"' ? '&quot;' : '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function restoreImageTag(tag: string, publicUrl: string): string {
  const image = parseHtmlElements(tag).find((element) => element.tagName === 'img')
  if (!image) return tag
  const replacements: TextReplacement[] = []
  let hasSource = false
  for (const attribute of image.attributes) {
    if (attribute.localName === 'src') {
      replacements.push(replaceAttributeValue(tag, attribute, publicUrl))
      hasSource = true
    } else if (attribute.localName === 'srcset' || attribute.localName === 'sizes') {
      replacements.push({
        startOffset: attribute.startOffset,
        endOffset: attribute.endOffset,
        value: '',
      })
    }
  }
  const restored = applyTextReplacements(tag, replacements)
  return hasSource
    ? restored
    : restored.replace(/<img\b/i, `<img src="${escapeAttribute(publicUrl)}"`)
}

const imageUrlAttributes = new Set(['href', 'imagesrcset', 'src', 'srcset'])

function referencesFailure(
  element: ParsedHtmlElement,
  outputUrl: string,
): boolean {
  return element.attributes.some((attribute) => (
    imageUrlAttributes.has(attribute.localName)
    && attribute.value.includes(outputUrl)
  ))
}

function restoreFailedUrls(
  html: string,
  failures: readonly { readonly outputUrl: string; readonly publicUrl: string }[],
): string {
  const replacements: TextReplacement[] = []
  for (const element of parseHtmlElements(html)) {
    for (const attribute of element.attributes) {
      if (!imageUrlAttributes.has(attribute.localName)) continue
      let value = attribute.value
      for (const failure of failures) {
        value = value.replaceAll(failure.outputUrl, failure.publicUrl)
      }
      if (value !== attribute.value) {
        replacements.push(replaceAttributeValue(html, attribute, value))
      }
    }
  }
  return applyTextReplacements(html, replacements)
}

/** Restores original content markup for derivatives that Sharp could not encode. */
export async function restoreFailedContentImages(
  clientDirectory: string,
  registry: ImageBuildRegistry,
  routes: readonly PublicationRoute[],
): Promise<number> {
  const failures = registry.failedContentImageFallbacks()
  if (failures.length === 0) return 0
  const files = htmlFiles(clientDirectory, routes)
  let restored = 0
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8')
    const elements = parseHtmlElements(html)
    const replacements: TextReplacement[] = []
    const replacedPictures: ParsedHtmlElement[] = []
    for (const picture of elements.filter((element) => element.tagName === 'picture')) {
      if (replacedPictures.some((parent) => (
        picture.startOffset >= parent.startOffset && picture.endOffset <= parent.endOffset
      ))) {
        continue
      }
      const descendants = elements.filter((element) => (
        element.startOffset >= picture.startOffset
        && element.startTagEndOffset <= picture.endOffset
      ))
      const failure = failures.find(({ outputUrl }) => (
        descendants.some((element) => referencesFailure(element, outputUrl))
      ))
      if (!failure) continue
      const image = descendants.find((element) => element.tagName === 'img')
      if (!image) continue
      replacements.push({
        startOffset: picture.startOffset,
        endOffset: picture.endOffset,
        value: restoreImageTag(
          html.slice(image.startOffset, image.startTagEndOffset),
          failure.publicUrl,
        ),
      })
      replacedPictures.push(picture)
      restored += 1
    }
    for (const image of elements.filter((element) => element.tagName === 'img')) {
      if (replacedPictures.some((picture) => (
        image.startOffset >= picture.startOffset && image.startTagEndOffset <= picture.endOffset
      ))) {
        continue
      }
      const failure = failures.find(({ outputUrl }) => referencesFailure(image, outputUrl))
      if (!failure) continue
      replacements.push({
        startOffset: image.startOffset,
        endOffset: image.startTagEndOffset,
        value: restoreImageTag(
          html.slice(image.startOffset, image.startTagEndOffset),
          failure.publicUrl,
        ),
      })
      restored += 1
    }
    const rewritten = restoreFailedUrls(
      applyTextReplacements(html, replacements),
      failures,
    )
    if (rewritten !== html) await fs.writeFile(file, rewritten)
  }
  if (restored > 0) console.warn(`nib-images: restored ${restored} content image reference(s)`)
  return restored
}
