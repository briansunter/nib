import { z } from 'zod'
import { normalizePath } from './paths'
import type {
  CollectionDefinition,
  PageSourceCollectionDefinition,
  CollectionEntry,
  CollectionLoaderContext,
  CollectionLoaderResult,
  DataSchema,
  DataValidator,
  GeneratedPage,
  InferDataValidator,
  LoadedCollectionDefinitions,
  MarkdownDefinition,
  PageMeta,
  PageSourceContext,
  PageSourceDefinition,
  PageSourceRenderer,
  PageSourcePage,
} from './types'

export const defaultMarkdownSchema = z.looseObject({
  title: z.string().optional(),
  description: z.string().optional(),
  draft: z.boolean().optional(),
  layout: z.string().min(1).optional(),
})

export function defineMarkdown<Data>(
  definition: Omit<MarkdownDefinition<(value: unknown) => Data>, 'schema'> & {
    schema?: never
    validate: (value: unknown) => Data
  },
): MarkdownDefinition<(value: unknown) => Data>
export function defineMarkdown<const Validator extends DataValidator>(
  definition: MarkdownDefinition<Validator>,
): MarkdownDefinition<Validator>
export function defineMarkdown(
  definition: MarkdownDefinition<any>,
): MarkdownDefinition<any> {
  return definition
}

export function definePageSource<Data>(
  definition: Omit<PageSourceDefinition<(value: unknown) => Data>, 'schema'> & {
    schema?: never
    validate: (value: unknown, context: PageSourceContext) => Data
  },
): PageSourceDefinition<(value: unknown) => Data>
export function definePageSource<const Validator extends DataValidator>(
  definition: PageSourceDefinition<Validator>,
): PageSourceDefinition<Validator>
export function definePageSource(
  definition: PageSourceDefinition<any>,
): PageSourceDefinition<any> {
  return definition
}

/**
 * Defers a data-page renderer. Prefer the module form for transformed imports:
 * Nib emits that import only after Vite has installed the graph's adapters.
 */
export function pageRenderer<Data = any>(
  load: NonNullable<PageSourceRenderer<Data>['load']>,
): PageSourceRenderer<Data>
export function pageRenderer<Data = any>(module: string, exportName?: string): PageSourceRenderer<Data>
export function pageRenderer<Data = any>(
  loadOrModule: NonNullable<PageSourceRenderer<Data>['load']> | string,
  exportName?: string,
): PageSourceRenderer<Data> {
  if (typeof loadOrModule === 'string') {
    return { module: loadOrModule, ...(exportName === undefined ? {} : { exportName }) }
  }
  return { load: loadOrModule }
}

/** Reuse the validated output of one page source as a typed collection. */
export function fromPageSource<const Validator extends DataValidator>(
  source: PageSourceDefinition<Validator>,
): PageSourceCollectionDefinition<Validator> {
  return { source }
}

export function defineCollection<Data>(
  definition: Omit<CollectionDefinition<(value: unknown) => Data>, 'schema'> & {
    schema?: never
    validate: (value: unknown, entry: { id: string }) => Data
  },
): CollectionDefinition<(value: unknown) => Data>
export function defineCollection<const Validator extends DataValidator>(
  definition: CollectionDefinition<Validator>,
): CollectionDefinition<Validator>
export function defineCollection(
  definition: CollectionDefinition<any>,
): CollectionDefinition<any> {
  return definition
}

export function parseData<Data>(
  value: unknown,
  options: {
    schema?: DataSchema<Data>
    validate?: (value: unknown) => Data
    label: string
  },
): Data {
  if (options.schema !== undefined && options.validate !== undefined) {
    throw new Error(`${options.label} must provide either schema or validate, not both`)
  }
  if (options.schema !== undefined && !isDataSchema(options.schema)) {
    throw new Error(`${options.label} schema must provide parse(value)`)
  }
  if (options.validate !== undefined && typeof options.validate !== 'function') {
    throw new Error(`${options.label} validate must be a function`)
  }
  try {
    if (options.schema) return options.schema.parse(value)
    if (options.validate) return options.validate(value)
    return value as Data
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`${options.label}: ${detail}`, { cause: error })
  }
}

function isDataSchema(value: unknown): value is DataSchema<unknown> {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { parse?: unknown }).parse === 'function'
}

export function validateDataDefinition(value: unknown, label: string): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  const definition = value as { schema?: unknown; validate?: unknown }
  if (definition.schema !== undefined && definition.validate !== undefined) {
    throw new Error(`${label} must provide either schema or validate, not both`)
  }
  if (definition.schema !== undefined && !isDataSchema(definition.schema)) {
    throw new Error(`${label} schema must provide parse(value)`)
  }
  if (definition.validate !== undefined && typeof definition.validate !== 'function') {
    throw new Error(`${label} validate must be a function`)
  }
}

function normalizeExtension(extension: string): string {
  const normalized = extension.startsWith('.') ? extension : `.${extension}`
  if (!/^\.[A-Za-z0-9]+$/.test(normalized)) {
    throw new Error(`Page source extension must contain only letters and numbers: ${extension}`)
  }
  return normalized.toLowerCase()
}

export function pageSourceExtensions(
  definitions: ReadonlyArray<{
    extensions: readonly string[]
    match?: (file: string) => boolean
    schema?: unknown
    validate?: unknown
    load: (...args: any[]) => unknown
    component: unknown
  }> | undefined,
): string[] {
  const extensions = new Set<string>()
  for (const [index, definition] of (definitions ?? []).entries()) {
    validateDataDefinition(definition, `Page source ${index}`)
    if (!Array.isArray(definition.extensions) || definition.extensions.length === 0) {
      throw new Error(`Page source ${index} must define at least one extension`)
    }
    if (typeof definition.load !== 'function') {
      throw new Error(`Page source ${index} must define a load function`)
    }
    if (
      typeof definition.component !== 'function'
      && (
        definition.component === null
        || typeof definition.component !== 'object'
        || (
          typeof (definition.component as PageSourceRenderer).load !== 'function'
          && typeof (definition.component as PageSourceRenderer).module !== 'string'
        )
      )
    ) {
      throw new Error(`Page source ${index} must define a React component or page renderer`)
    }
    if (typeof definition.component === 'object' && definition.component !== null) {
      const renderer = definition.component as PageSourceRenderer
      if (renderer.module !== undefined && (typeof renderer.module !== 'string' || renderer.module.trim() === '')) {
        throw new Error(`Page source ${index} page renderer module must be a non-empty string`)
      }
      if (
        renderer.exportName !== undefined
        && (
          typeof renderer.exportName !== 'string'
          || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(renderer.exportName)
        )
      ) {
        throw new Error(`Page source ${index} page renderer exportName must be a JavaScript identifier`)
      }
    }
    if (definition.match !== undefined && typeof definition.match !== 'function') {
      throw new Error(`Page source ${index} match must be a function`)
    }
    for (const rawExtension of definition.extensions) {
      const extension = normalizeExtension(rawExtension)
      extensions.add(extension)
    }
  }
  return [...extensions]
}

const pageRendererLoads = new WeakMap<object, Promise<GeneratedPage['component']>>()

async function pageSourceComponent<Validator extends DataValidator>(
  definition: PageSourceDefinition<Validator>,
  label: string,
  importedComponent?: GeneratedPage['component'],
): Promise<GeneratedPage['component']> {
  if (importedComponent !== undefined) return importedComponent
  if (typeof definition.component === 'function') return definition.component
  const renderer = definition.component
  if (typeof renderer.load !== 'function') {
    throw new Error(`${label} page renderer module must be imported through Nib's Vite page-source module`)
  }
  const cached = pageRendererLoads.get(renderer)
  if (cached !== undefined) return cached
  const load = renderer.load().then((loaded) => {
    const component = typeof loaded === 'function' ? loaded : loaded?.default
    if (typeof component !== 'function') {
      throw new Error(`${label} page renderer must resolve to a default React component`)
    }
    return component
  })
  pageRendererLoads.set(renderer, load)
  return load
}

export function pageSourceIndex(
  definitions: ReadonlyArray<{
    extensions: readonly string[]
    match?: (file: string) => boolean
  }> | undefined,
  extension: string,
  file: string,
): number | undefined {
  const normalized = normalizeExtension(extension)
  const normalizedFile = file.replaceAll('\\', '/')
  const matches = (definitions ?? [])
    .map((definition, index) => ({ definition, index }))
    .filter(({ definition }) => (
      definition.extensions.some((candidate) => normalizeExtension(candidate) === normalized)
      && (definition.match?.(normalizedFile) ?? true)
    ))
  if (matches.length > 1) {
    throw new Error(`Multiple page sources match ${normalizedFile}`)
  }
  return matches[0]?.index
}

function normalizePagePath(value: string, label: string): string {
  if (
    !value.startsWith('/')
    || value.includes('?')
    || value.includes('#')
    || value.includes('\\')
  ) {
    throw new Error(`${label} must start with "/" and contain no query, hash, or backslash`)
  }
  return normalizePath(value)
}

function getLayoutName(layout: unknown, label: string): string | undefined {
  if (layout === undefined) return undefined
  if (typeof layout !== 'string' || !/^[A-Za-z0-9_-]+$/.test(layout)) {
    throw new Error(`${label} layout must be a flat name`)
  }
  return layout
}

function getPageMeta(meta: unknown, label: string): PageMeta | undefined {
  if (meta === undefined) return undefined
  const parsed = z.looseObject({
    title: z.string().optional(),
    description: z.string().optional(),
    draft: z.boolean().optional(),
  }).safeParse(meta)
  if (!parsed.success) throw new Error(`${label} metadata: ${parsed.error.message}`)
  return {
    ...(parsed.data.title === undefined ? {} : { title: parsed.data.title }),
    ...(parsed.data.description === undefined ? {} : { description: parsed.data.description }),
    ...(parsed.data.draft === undefined ? {} : { draft: parsed.data.draft }),
  }
}

function isPageSourcePage(value: unknown): value is PageSourcePage {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && 'data' in value
}

export async function compileDataPages<
  Validator extends DataValidator,
>(
  definition: PageSourceDefinition<Validator>,
  context: PageSourceContext,
  importedComponent?: GeneratedPage['component'],
): Promise<GeneratedPage[]> {
  validateDataDefinition(definition, `Page source ${context.file}`)
  const component = await pageSourceComponent(definition, `Page source ${context.file}`, importedComponent)
  const loaded = await definition.load(context)
  const pages = Array.isArray(loaded) ? loaded : [loaded]

  return pages.map((page, index) => {
    const label = `${context.file}${pages.length > 1 ? ` entry ${index}` : ''}`
    if (!isPageSourcePage(page)) {
      throw new Error(`${label} must return an object with a data field`)
    }
    const data = parseData<InferDataValidator<Validator>>(page.data, {
      ...(definition.schema ? { schema: definition.schema as DataSchema<InferDataValidator<Validator>> } : {}),
      ...(definition.validate
        ? { validate: (value) => definition.validate?.(value, context) as InferDataValidator<Validator> }
        : {}),
      label: `${label} data`,
    })
    const meta = getPageMeta(page.meta, label)
    const layout = getLayoutName(page.layout, label)
    const path = normalizePagePath(page.path ?? context.defaultPath, `${label} path`)
    return {
      path,
      component,
      data,
      ...(meta ? { meta } : {}),
      ...(layout ? { layout } : {}),
      sourceDefinition: definition,
      collectionId: page.collectionId ?? path.replace(/^\/+|\/+$/g, ''),
    }
  })
}

function collectionEntries(result: CollectionLoaderResult): Array<{ id: string; data: unknown }> {
  return Array.isArray(result)
    ? result
    : Object.entries(result).map(([id, data]) => ({ id, data }))
}

const nodeFsModule = 'node:fs/promises'
const nodePathModule = 'node:path'
const tinyglobbyModule = 'tinyglobby'

async function safeProjectFile(root: string, file: string): Promise<string> {
  const path = await import(/* @vite-ignore */ nodePathModule)
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, file)
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Content file escapes the project root: ${file}`)
  }
  return resolved
}

export async function loadCollections<
  const Definitions extends Record<string, CollectionDefinition<any> | PageSourceCollectionDefinition<any>>,
>(
  definitions: Definitions | undefined,
  root: string,
  pageSourceEntries: ReadonlyMap<PageSourceDefinition<any>, readonly CollectionEntry[]> = new Map(),
): Promise<LoadedCollectionDefinitions<Definitions>> {
  const collections: Record<string, CollectionEntry[]> = {}
  const context: CollectionLoaderContext = {
    root,
    async read(file) {
      const fs = await import(/* @vite-ignore */ nodeFsModule)
      return fs.readFile(await safeProjectFile(root, file), 'utf8')
    },
  }

  for (const [name, definition] of Object.entries(definitions ?? {})) {
    if ('source' in definition) {
      const entries = pageSourceEntries.get(definition.source) ?? []
      const seen = new Set<string>()
      collections[name] = entries.map((entry) => {
        if (seen.has(entry.id)) throw new Error(`Duplicate collection entry ${name}/${entry.id}`)
        seen.add(entry.id)
        return { id: entry.id, data: entry.data }
      })
      continue
    }
    validateDataDefinition(definition, `Collection ${name}`)
    if (typeof definition.loader !== 'function') {
      throw new Error(`Collection ${name} must define a loader function`)
    }
    const seen = new Set<string>()
    const result = await definition.loader(context)
    collections[name] = collectionEntries(result).map((entry) => {
      if (typeof entry.id !== 'string' || entry.id.trim() === '') {
        throw new Error(`Collection ${name} entry id must be a non-empty string`)
      }
      if (seen.has(entry.id)) {
        throw new Error(`Duplicate collection entry ${name}/${entry.id}`)
      }
      seen.add(entry.id)
      return {
        id: entry.id,
        data: parseData(entry.data, {
          ...(definition.schema ? { schema: definition.schema as DataSchema } : {}),
          ...(definition.validate
            ? { validate: (value) => definition.validate?.(value, { id: entry.id }) }
            : {}),
          label: `Collection ${name}/${entry.id}`,
        }),
      }
    })
  }

  return collections as LoadedCollectionDefinitions<Definitions>
}

export interface GlobLoaderFile {
  id: string
  file: string
  source: string
}

export interface GlobLoaderOptions {
  base: string
  pattern: string | string[]
  load(file: GlobLoaderFile): unknown | Promise<unknown>
}

export function glob(options: GlobLoaderOptions) {
  return async ({ root }: CollectionLoaderContext): Promise<CollectionLoaderResult> => {
    const fs = await import(/* @vite-ignore */ nodeFsModule)
    const path = await import(/* @vite-ignore */ nodePathModule)
    const { glob: findFiles } = await import(/* @vite-ignore */ tinyglobbyModule)
    const base = await safeProjectFile(root, options.base)
    const files = await findFiles(options.pattern, {
      cwd: base,
      onlyFiles: true,
    })
    return Promise.all(files.sort().map(async (relativeFile: string) => {
      const file = path.posix.join(options.base.replaceAll('\\', '/'), relativeFile)
      const extension = path.posix.extname(relativeFile)
      const id = relativeFile.slice(0, extension ? -extension.length : undefined)
      return {
        id,
        data: await options.load({
          id,
          file,
          source: await fs.readFile(path.join(base, relativeFile), 'utf8'),
        }),
      }
    }))
  }
}

export interface FileLoaderOptions {
  file: string
  load(source: string): CollectionLoaderResult | Promise<CollectionLoaderResult>
}

export function file(options: FileLoaderOptions) {
  return async (context: CollectionLoaderContext): Promise<CollectionLoaderResult> => (
    options.load(await context.read(options.file))
  )
}
