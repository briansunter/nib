import type { ComponentType, ReactNode } from 'react'
import type { Pluggable } from 'unified'
import type { PluginOption } from 'vite'
import type {
  Awaitable,
  NibPlugin,
  NibVitePluginContext,
} from './extensions/contracts'
import type { ContentRenderer, MarkdownContent } from './markdown-content'
import type { PublicationManifestRoute } from './publication'

export type MetadataImage =
  | string
  | {
      src: string
      alt?: string
      width?: number
      height?: number
      type?: string
    }

export interface PageMeta {
  title: string
  description?: string
  draft?: boolean
  head?: HeadContribution
  /** Route-level social preview image; overrides the metadata plugin default. */
  image?: MetadataImage
  /** Open Graph object type; overrides the metadata plugin default. */
  type?: 'website' | 'article'
  /** Twitter card style; overrides the metadata plugin default. */
  twitterCard?: 'summary' | 'summary_large_image'
}

export type HeadTagName = 'meta' | 'link' | 'script' | 'style'
export type HeadAttributeValue = string | number | boolean

/** A structured document-head element rendered by Nib with escaped attributes. */
export interface HeadElement {
  readonly key?: string
  readonly tag: HeadTagName
  readonly attributes?: Readonly<Record<string, HeadAttributeValue>>
  readonly content?: string
}

/** Structured document-head additions and optional final metadata overrides. */
export interface HeadContribution {
  readonly title?: string
  readonly description?: string
  readonly elements?: readonly HeadElement[]
}

export interface MarkdownSourceContext {
  /** Absolute or project-relative source path exposed to Unified plugins. */
  readonly file: string
}

export interface MarkdownMetaContext<Frontmatter> {
  readonly frontmatter: Frontmatter
  readonly path: string
  readonly source: string
  readonly defaults: PageMeta
}

export interface DataSchema<Data = unknown> {
  parse(value: unknown): Data
}

export type DataValidator<Data = unknown> =
  | DataSchema<Data>
  | ((value: unknown) => Data)

export type InferDataValidator<Validator> =
  Validator extends DataSchema<infer Data>
    ? Data
    : Validator extends (value: unknown) => infer Data
      ? Data
      : unknown

type SchemaValidator<Validator extends DataValidator> =
  Validator extends DataSchema<unknown> ? Validator : never

export interface PageSourceContext {
  file: string
  source: string
  defaultPath: string
}

export interface PageSourcePage<Data = unknown> {
  path?: string
  /** Stable collection identity when one input expands into multiple routes. */
  collectionId?: string
  data: Data
  meta: PageMeta
  layout?: string
}

/** Defers a data-page renderer until the server Vite graph has loaded it. */
export interface PageSourceRenderer<Data = any> {
  /** A programmatic loader for renderers that do not need Vite transforms. */
  readonly load?: () => Promise<
    | ComponentType<DataPageProps<Data, any>>
    | { default?: ComponentType<DataPageProps<Data, any>> }
  >
  /** Project-relative module, imported by Nib's Vite data-page module. */
  readonly module?: string
  /** Named export to use from `module`; defaults to `default`. */
  readonly exportName?: string
}

export type PageSourceComponent<Data = any> =
  | ComponentType<DataPageProps<Data, any>>
  | PageSourceRenderer<Data>

/** One route generated from a validated collection entry. */
export interface DerivedPage<Data = unknown> {
  path: string
  data: Data
  meta: PageMeta
  layout?: string
}

/** Generates routes from a collection capability after collections load. */
export interface DerivedPagesDefinition<Data = unknown> {
  /** Maps validated collection entries to derived page specs (sync). */
  readonly pages: CollectionCapability<readonly DerivedPage<Data>[]>
  /** React component or deferred pageRenderer() for each derived page. */
  readonly component: PageSourceComponent<Data>
  /** Optional default named layout applied to every derived page. */
  readonly layout?: string
}

export interface PageSourceDefinition<
  Validator extends DataValidator = DataValidator,
> {
  extensions: readonly string[]
  /**
   * Vite glob patterns for content files that should be compiled as page
   * sources. Without patterns, sources retain Nib's nested page-file
   * convention (`src/pages/.../page.<extension>`).
   */
  patterns?: readonly string[]
  match?: (file: string) => boolean
  schema?: SchemaValidator<Validator>
  validate?: Validator extends DataSchema<unknown>
    ? never
    : (value: unknown, context: PageSourceContext) => InferDataValidator<Validator>
  load: (
    context: PageSourceContext,
  ) => PageSourcePage | PageSourcePage[] | Promise<PageSourcePage | PageSourcePage[]>
  component: PageSourceComponent<InferDataValidator<Validator>>
}

export interface CollectionEntry<Data = unknown> {
  id: string
  data: Data
}

export interface CollectionLoaderContext {
  root: string
  read(file: string): Promise<string>
}

export type CollectionLoaderResult =
  | Array<{ id: string; data: unknown }>
  | Record<string, unknown>

export interface CollectionDefinition<
  Validator extends DataValidator = DataValidator,
> {
  loader: (
    context: CollectionLoaderContext,
  ) => CollectionLoaderResult | Promise<CollectionLoaderResult>
  schema?: SchemaValidator<Validator>
  validate?: Validator extends DataSchema<unknown>
    ? never
    : (
        value: unknown,
        entry: { id: string },
      ) => InferDataValidator<Validator>
}

/** Reuses already compiled and validated data-page entries as a collection. */
export interface PageSourceCollectionDefinition<
  Validator extends DataValidator = DataValidator,
> {
  readonly source: PageSourceDefinition<Validator>
}

export interface PageDescriptor<Frontmatter = unknown, Data = unknown> {
  readonly path: string
  readonly source: string
  readonly meta: ResolvedPageMeta
  readonly frontmatter: Frontmatter | undefined
  readonly data: Data | undefined
}

/** Derives immutable collection entries from validated page descriptors. */
export interface PageCollectionDefinition<Frontmatter = unknown, Selected = unknown> {
  readonly pages: true
  readonly markdownOnly: boolean
  readonly match: (page: PageDescriptor<Frontmatter>) => boolean
  readonly id: (page: PageDescriptor<Frontmatter>) => string
  readonly select: (page: PageDescriptor<Frontmatter>) => Selected
  readonly sort?: (left: PageDescriptor<Frontmatter>, right: PageDescriptor<Frontmatter>) => number
}

export type AnyCollectionDefinition<
  Validator extends DataValidator = DataValidator,
> =
  | CollectionDefinition<Validator>
  | PageSourceCollectionDefinition<Validator>
  | PageCollectionDefinition<any, any>

export interface MarkdownDefinition<
  Validator extends DataValidator = DataValidator,
> {
  schema?: SchemaValidator<Validator>
  validate?: Validator extends DataSchema<unknown>
    ? never
    : (value: unknown) => InferDataValidator<Validator>
  /** Disable Nib's built-in GFM pass when a site supplies its own variant. */
  gfm?: boolean
  /** Unified remark plugins, applied after Nib's GFM parser. */
  remarkPlugins?: readonly Pluggable[]
  /**
   * Keep raw HTML nodes for trusted, application-owned content. The default
   * remains false so Markdown cannot introduce arbitrary HTML by accident.
   */
  allowDangerousHtml?: boolean
  /** Unified rehype plugins, applied before HTML serialization. */
  rehypePlugins?: readonly Pluggable[]
  /**
   * Computes route metadata from validated frontmatter after Nib's default
   * extraction. Return a PageMeta to replace the defaults (spread `defaults`
   * to keep them), or return nothing to keep the defaults. The default
   * extraction runs unchanged when this is absent.
   *
   * Declared as a method so a `MarkdownDefinition<SpecificValidator>` remains
   * assignable to `MarkdownDefinition<any>` (the site-config slot): method
   * parameters are checked bivariantly, which neutralizes the contravariance
   * that would otherwise make the frontmatter-typed callback reject widening.
   */
  meta?(context: MarkdownMetaContext<InferDataValidator<Validator>>): PageMeta | void
}

export type TrailingSlash = 'always' | 'never' | 'ignore'
export type RedirectStatus = 301 | 302 | 307 | 308

export type NibHostingAdapter = 'netlify' | 'vercel' | 'cloudflare' | 's3'

export interface NibHostingAdapterConfig {
  readonly name: NibHostingAdapter
  /** S3: materialize a <path>.html companion for every HTML route artifact. */
  readonly htmlAliases?: boolean
}

export interface NibHostingConfig {
  /** Generate deploy-specific companions from the publication manifest. */
  readonly adapters?: readonly (NibHostingAdapter | NibHostingAdapterConfig)[]
}

export type RedirectDefinition =
  | string
  | {
      destination: string
      status?: RedirectStatus
    }

/** App-owned Vite contributions. Nib continues to own entries, SSR, base path,
 * and output settings. The factory runs separately for each Vite graph. */
export type NibViteConfig = (
  context: NibVitePluginContext,
) => Awaitable<PluginOption>

export interface NibConfig {
  base?: string
  /** Canonical deployed origin shared by canonical metadata and resource serializers. */
  origin?: string
  trailingSlash?: TrailingSlash
  hosting?: NibHostingConfig
  redirects?: Readonly<Record<string, RedirectDefinition>>
  vite?: NibViteConfig
  plugins?: readonly NibPlugin[]
  shell?: ComponentType<SiteShellProps<any>>
  markdown?: MarkdownDefinition<any>
  pageSources?: readonly PageSourceDefinition<any>[]
  collections?: Record<string, AnyCollectionDefinition<any>>
  derivedPages?: readonly DerivedPagesDefinition<any>[]
}

export type CollectionData<Definition> =
  Definition extends CollectionDefinition<infer Validator>
    ? InferDataValidator<Validator>
    : Definition extends PageSourceCollectionDefinition<infer Validator>
      ? InferDataValidator<Validator>
      : Definition extends PageCollectionDefinition<infer Frontmatter, infer Selected>
        ? Selected
    : never

export type LoadedCollections<Config extends NibConfig> =
  Config extends { collections: infer Definitions }
    ? LoadedCollectionDefinitions<Definitions>
    : Record<string, never>

export type LoadedCollectionDefinitions<Definitions> = {
  [Name in keyof Definitions]:
    Definitions[Name] extends AnyCollectionDefinition<any>
      ? Array<CollectionEntry<CollectionData<Definitions[Name]>>>
      : never
}

/** Explicit least-privilege grant for a build-time resource provider. */
export interface CollectionCapability<Result = unknown> {
  readonly kind: 'collection-capability'
  readonly collection: AnyCollectionDefinition<any>
  readonly map: (entries: readonly CollectionEntry[]) => Result
}

export interface PageProps<Config extends NibConfig = NibConfig> {
  /** Stable public facts about the route being rendered. */
  readonly route: PageRoute
  readonly collections: LoadedCollections<Config>
}

export interface DataPageProps<
  Data = unknown,
  Config extends NibConfig = NibConfig,
> extends PageProps<Config> {
  data: Data
}

export interface PageLayoutProps<
  Frontmatter = unknown,
  Config extends NibConfig = NibConfig,
  Data = Frontmatter,
> extends PageProps<Config> {
  children: ReactNode
  data: Data | undefined
  frontmatter: Frontmatter | undefined
  /** Bound Markdown content for layouts that own the semantic content root. */
  Content: ContentRenderer | undefined
}

export interface SiteShellProps<
  Config extends NibConfig = NibConfig,
> extends PageProps<Config> {
  children: ReactNode
}

/** Minimal config shape keyed off a site's collections, for typing shells and props. */
export type SiteConfigFor<
  Collections extends Record<string, AnyCollectionDefinition>,
> = {
  collections: Collections
}

/** Validated, immutable metadata authored by the page. */
export type ResolvedPageMeta = Readonly<PageMeta>

/** The immutable route facts exposed to pages and plugins. */
export interface PageRoute {
  readonly kind: 'page'
  readonly path: string
  readonly source: string
  readonly status: number
  readonly meta: ResolvedPageMeta
}

/** Immutable facts for a generated static resource. */
export interface ResourceRoute {
  readonly kind: 'resource'
  readonly path: string
  readonly source: string
  readonly status: number
  readonly contentType: string
}

/** Immutable facts for a generated redirect. */
export interface RedirectRoute {
  readonly kind: 'redirect'
  readonly path: string
  readonly source: string
  readonly status: RedirectStatus
  readonly destination: string
}

export type RouteSnapshot = PageRoute | ResourceRoute | RedirectRoute

export interface PageModule {
  default?: ComponentType<any>
  meta?: PageMeta
  frontmatter?: unknown
  layout?: string
  content?: MarkdownContent
  pages?: GeneratedPage[]
}

export interface GeneratedPage {
  path: string
  component: ComponentType<any>
  data: unknown
  meta?: PageMeta
  layout?: string
  /** @internal Links compiled entries to fromPageSource() collections. */
  sourceDefinition?: PageSourceDefinition<any>
  /** @internal Defaults to the generated public path without slashes; "/" uses "index". */
  collectionId?: string
}

export interface ResolvedPageRoute extends PageRoute {
  component: ComponentType<any>
  data?: unknown
  frontmatter?: unknown
  content?: MarkdownContent
  layouts: ComponentType<any>[]
}

export interface ResolvedResourceRoute extends ResourceRoute {
  body: string
}

export type ResolvedRedirectRoute = RedirectRoute

export type ResolvedRoute =
  | ResolvedPageRoute
  | ResolvedResourceRoute
  | ResolvedRedirectRoute

export interface RenderedPage {
  status: number
  head: string
  html: string
  islands: string[]
  behaviors: string[]
}

export type RenderedOutput =
  | { kind: 'page'; page: RenderedPage }
  | {
      kind: 'resource'
      status: number
      body: string
      contentType: string
    }
  | {
      kind: 'redirect'
      status: RedirectStatus
      destination: string
    }

/** A private staging directory for a transactional build output. */
export interface StagedDirectory {
  /** Absolute path of the staging directory; write generated files here. */
  readonly path: string
  /** Atomically publish the staged directory contents to <output>/<target>. */
  publishTo(target: string): Promise<void>
}

/**
 * Guarded build-output API for finalizers. Reuses the publication manifest's
 * route artifacts for reads, and writes through a path-contained, atomic API
 * so build plugins stop reimplementing safe resolution and directory swaps.
 */
export interface NibBuildOutput {
  /** Reads a published page/resource route's artifact as text. */
  readText(route: PublicationManifestRoute): Promise<string>
  /** Reads a published page/resource route's artifact as bytes. */
  readBytes(route: PublicationManifestRoute): Promise<Uint8Array>
  /**
   * Writes a generated artifact into the output directory. Rejects absolute
   * paths and traversal, creates parent directories, and replaces atomically.
   */
  write(artifact: string, body: string | Uint8Array): Promise<void>
  /** Creates a private staging directory for a transactional output (e.g. Pagefind). */
  stageDirectory(name: string): Promise<StagedDirectory>
}
