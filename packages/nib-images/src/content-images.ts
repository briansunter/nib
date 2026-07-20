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

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of entries) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(file))
    else files.push(file)
  }
  return files
}

function outputPrefix(clientDirectory: string, base: string, publicPath: string): string {
  return path.join(
    clientDirectory,
    base.replace(/^\/+|\/+$/g, ''),
    publicPath.replace(/^\/+/, ''),
  )
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
  base: string,
  source: NormalizedContentImageSource,
  sourceFile: string,
): Promise<void> {
  const relative = path.relative(source.directory, sourceFile)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return
  const target = path.join(outputPrefix(clientDirectory, base, source.publicPath), relative)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.copyFile(sourceFile, target)
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
  await Promise.all([...references].flatMap((reference) => {
    const match = sourceForUrl(reference, base, options)
    return match === undefined ? [] : [copyContentSource(clientDirectory, base, match.source, match.file)]
  }))
}

function htmlFiles(clientDirectory: string, files: readonly string[]): string[] {
  const ignored = new Set(['.nib', 'assets', 'fonts', 'site-assets', 'videos'])
  return files.filter((file) => {
    const relative = path.relative(clientDirectory, file)
    if (relative.split(path.sep).some((segment) => ignored.has(segment))) return false
    const extension = path.extname(file)
    return extension === '' || extension === '.html'
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
      ['src', 'alt', 'srcset', 'sizes', 'width', 'height', 'loading', 'decoding', 'fetchpriority', 'style']
        .includes(name)
    ) continue
    const reactName = name === 'class' ? 'className' : name === 'referrerpolicy' ? 'referrerPolicy' : name
    result[reactName] = value
  }
  return result
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
  let replacements = 0
  const rewritten = await replaceAsync(html, /<img\b([^>]*?)>/gi, async (full, rawAttributes: string) => {
    const input = parseAttributes(rawAttributes)
    const src = input.src
    if (!src) return full
    const match = sourceForUrl(src, base, options)
    if (!match) return full
    const { source: sourceDefinition, file: sourceFile } = match
    let source = sourceCache.get(sourceFile)
    try {
      await copyContentSource(clientDirectory, base, sourceDefinition, sourceFile)
      if (!source) {
        source = await catalog.load(sourceFile)
        sourceCache.set(sourceFile, source)
      }
      const fallback: ContentImageFallback = { sourceFile, publicUrl: src }
      registry.registerContentFallback(source, fallback)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(`nib-images: preserving ${src} after source inspection failure: ${detail}`)
      return full
    }
    const highPriority = input.fetchpriority?.toLowerCase() === 'high'
    const loading = input.loading === 'lazy' || input.loading === 'eager' ? input.loading : undefined
    const props = {
      ...reactAttributes(input),
      src: source,
      alt: input.alt ?? '',
      layout: 'constrained' as const,
      maxWidth: source.width,
      ...(sourceDefinition.widths === undefined ? {} : { widths: sourceDefinition.widths }),
      ...(sourceDefinition.sizes === undefined ? {} : { sizes: sourceDefinition.sizes }),
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
): Promise<number> {
  if (options.content.length === 0) return 0
  const catalog = new ImageSourceCatalog(options)
  const sourceCache = new Map<string, Awaited<ReturnType<ImageSourceCatalog['load']>>>()
  const files = htmlFiles(clientDirectory, await filesUnder(clientDirectory))
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
): Promise<number> {
  const failures = registry.failedContentImageFallbacks()
  if (failures.length === 0) return 0
  const files = htmlFiles(clientDirectory, await filesUnder(clientDirectory))
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
