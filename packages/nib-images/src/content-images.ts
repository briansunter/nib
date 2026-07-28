import fs from 'node:fs/promises'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Image } from './image-component'
import { ImageRegistryProvider } from './image-context'
import type { ImageBuildRegistry } from './image-registry'
import type { ContentImageFallback } from './image-registry'
import { ImageSourceCatalog } from './image-source-catalog'
import type { ImageProps } from './image-component'
import type { NormalizedContentImageSource, NormalizedImagesOptions } from './options'

interface HtmlAttributes {
  readonly [name: string]: string
}

interface PublicationRoute {
  readonly kind: string
  readonly artifact: string
  readonly contentType: string
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
  const parsed = new URL(src, 'http://nib.local')
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
    for (const match of html.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) {
      if (match[2]) references.add(match[2])
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

function parseAttributes(value: string): HtmlAttributes {
  const result: Record<string, string> = {}
  for (const match of value.matchAll(/([A-Za-z_:][A-Za-z0-9:._-]*)(?:\s*=\s*(?:(["'])(.*?)\2|([^\s>]+)))?/g)) {
    const name = match[1]!.toLowerCase()
    result[name] = match[3] ?? match[4] ?? ''
  }
  return result
}

function relativeSourceFile(
  src: string,
  source: NormalizedContentImageSource,
  base: string,
): string | undefined {
  let pathname: string
  try {
    pathname = new URL(src, 'http://nib.local').pathname
  } catch {
    return undefined
  }
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

async function replaceAsync(
  value: string,
  expression: RegExp,
  replacer: (full: string, ...groups: string[]) => Promise<string>,
): Promise<string> {
  const matches = [...value.matchAll(expression)]
  if (matches.length === 0) return value
  let output = ''
  let cursor = 0
  for (const match of matches) {
    output += value.slice(cursor, match.index)
    output += await replacer(match[0]!, ...(match.slice(1) as string[]))
    cursor = (match.index ?? 0) + match[0]!.length
  }
  return output + value.slice(cursor)
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
  const normalizedHtml = html.replace(
    /\b(src|href)\s*=\s*(["'])(.*?)\2/gi,
    (attribute, _name: string, quote: string, reference: string) => (
      sourceForUrl(reference, base, options) === undefined
        ? attribute
        : attribute.replace(
            `${quote}${reference}${quote}`,
            `${quote}${escapeAttribute(publicContentUrl(reference, base))}${quote}`,
          )
    ),
  )
  let replacements = 0
  const rewritten = await replaceAsync(normalizedHtml, /<img\b([^>]*?)>/gi, async (full, rawAttributes: string) => {
    const input = parseAttributes(rawAttributes)
    const src = input.src
    if (!src) return full
    const match = sourceForUrl(src, base, options)
    if (!match) return full
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
      return full
    }
    const highPriority = input.fetchpriority?.toLowerCase() === 'high'
    const loading = input.loading === 'lazy' || input.loading === 'eager' ? input.loading : undefined
    let authoredWidth: number | undefined
    let authoredWidths: readonly number[] | undefined
    try {
      authoredWidth = parseAuthoredWidth(input['data-nib-width'])
      authoredWidths = parseAuthoredWidths(input['data-nib-widths'])
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(`nib-images: ${detail}; preserving ${src}`)
      return full
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
      ...(highPriority ? { priority: true as const } : loading === undefined ? {} : { loading }),
    } as ImageProps
    replacements += 1
    return renderToStaticMarkup(createElement(
      ImageRegistryProvider,
      { registry, children: createElement(Image, props) },
    ))
  })
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

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function restoreImageTag(tag: string, publicUrl: string): string {
  const restored = tag
    .replace(/\s(?:srcset|sizes)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /(\bsrc\s*=\s*)(["'])(.*?)(\2)/i,
      (_match, prefix: string, quote: string) => `${prefix}${quote}${escapeAttribute(publicUrl)}${quote}`,
    )
  return restored.includes('src=')
    ? restored
    : restored.replace(/<img\b/i, `<img src="${escapeAttribute(publicUrl)}"`)
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
    let rewritten = html.replace(/<picture\b[\s\S]*?<\/picture>/gi, (picture) => {
      const failure = failures.find(({ outputUrl }) => picture.includes(outputUrl))
      if (!failure) return picture
      const image = picture.match(/<img\b[^>]*>/i)?.[0]
      restored += 1
      return image === undefined ? picture : restoreImageTag(image, failure.publicUrl)
    }).replace(/<img\b[^>]*>/gi, (image) => {
      const failure = failures.find(({ outputUrl }) => image.includes(outputUrl))
      if (!failure) return image
      restored += 1
      return restoreImageTag(image, failure.publicUrl)
    })
    for (const failure of failures) rewritten = rewritten.replaceAll(failure.outputUrl, failure.publicUrl)
    if (rewritten !== html) await fs.writeFile(file, rewritten)
  }
  if (restored > 0) console.warn(`nib-images: restored ${restored} content image reference(s)`)
  return restored
}
