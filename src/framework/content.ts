import { z } from 'zod'
import { normalizeHeadContribution } from './meta'
import { normalizePath } from './paths'
import type {
  CollectionDefinition,
  PageSourceCollectionDefinition,
  DataSchema,
  DataValidator,
  GeneratedPage,
  InferDataValidator,
  MarkdownDefinition,
  PageMeta,
  PageSourceContext,
  PageSourceDefinition,
  PageSourceRenderer,
  PageSourcePage,
  PageCollectionDefinition,
  PageDescriptor,
  AnyCollectionDefinition,
  CollectionCapability,
  CollectionData,
  CollectionEntry,
} from './types'

const pageMetaSchema = z.looseObject({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  draft: z.boolean().optional(),
  head: z.unknown().optional(),
  image: z.string().optional(),
  type: z.enum(['website', 'article']).optional(),
  twitterCard: z.enum(['summary', 'summary_large_image']).optional(),
})

export const defaultMarkdownSchema = pageMetaSchema.extend({
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

export interface FromPagesOptions<Selected> {
  match(page: PageDescriptor): boolean
  id(page: PageDescriptor): string
  select(page: PageDescriptor): Selected
  sort?(left: PageDescriptor, right: PageDescriptor): number
}

/** Derives a typed collection from immutable validated page descriptors. */
export function fromPages<Selected>(
  options: FromPagesOptions<Selected>,
): PageCollectionDefinition<Selected> {
  if (
    typeof options?.match !== 'function'
    || typeof options.id !== 'function'
    || typeof options.select !== 'function'
  ) {
    throw new Error('fromPages requires match, id, and select callbacks')
  }
  return Object.freeze({
    pages: true as const,
    markdownOnly: false,
    ...options,
  })
}

/** Like fromPages(), but considers only authored Markdown route modules. */
export function fromMarkdownPages<Selected>(
  options: FromPagesOptions<Selected>,
): PageCollectionDefinition<Selected> {
  const definition = fromPages(options)
  return Object.freeze({ ...definition, markdownOnly: true })
}

/** Grants a resource provider mapped, immutable access to one collection. */
export function fromCollection<
  Definition extends AnyCollectionDefinition<any>,
  Result,
>(
  collection: Definition,
  mapper: (
    entries: readonly CollectionEntry<CollectionData<Definition>>[],
  ) => Result,
): CollectionCapability<Result> {
  if (typeof mapper !== 'function') throw new Error('fromCollection requires a mapper function')
  return Object.freeze({
    kind: 'collection-capability' as const,
    collection,
    map: mapper as (entries: readonly CollectionEntry[]) => Result,
  })
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
    patterns?: readonly string[]
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
    if (
      definition.patterns !== undefined
      && (
        !Array.isArray(definition.patterns)
        || definition.patterns.length === 0
        || definition.patterns.some((pattern) => typeof pattern !== 'string' || pattern.trim() === '')
      )
    ) {
      throw new Error(`Page source ${index} patterns must contain non-empty strings`)
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

/** Returns validated Vite glob patterns contributed by content sources. */
export function pageSourcePatterns(
  definitions: ReadonlyArray<{
    patterns?: readonly string[]
  }> | undefined,
): string[] {
  const patterns = new Set<string>()
  for (const definition of definitions ?? []) {
    for (const pattern of definition.patterns ?? []) {
      patterns.add(pattern)
    }
  }
  return [...patterns]
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
    || value.startsWith('//')
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

function getPageMeta(meta: unknown, label: string): PageMeta {
  const parsed = pageMetaSchema.safeParse(meta)
  if (!parsed.success) throw new Error(`${label} metadata: ${parsed.error.message}`)
  const head = normalizeHeadContribution(parsed.data.head, `${label} head`)
  return {
    title: parsed.data.title,
    ...(parsed.data.description === undefined ? {} : { description: parsed.data.description }),
    ...(parsed.data.draft === undefined ? {} : { draft: parsed.data.draft }),
    ...(head === undefined ? {} : { head }),
    ...(parsed.data.image === undefined ? {} : { image: parsed.data.image }),
    ...(parsed.data.type === undefined ? {} : { type: parsed.data.type }),
    ...(parsed.data.twitterCard === undefined ? {} : { twitterCard: parsed.data.twitterCard }),
  }
}

function getCollectionId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} collectionId must be a non-empty string`)
  }
  return value
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
    const defaultCollectionId = path.replace(/^\/+|\/+$/g, '') || 'index'
    const collectionId = getCollectionId(
      page.collectionId ?? defaultCollectionId,
      label,
    )
    return {
      path,
      component,
      data,
      meta,
      ...(layout ? { layout } : {}),
      sourceDefinition: definition,
      collectionId,
    }
  })
}
