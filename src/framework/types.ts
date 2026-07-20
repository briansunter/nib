import type { ComponentType, ReactNode } from 'react'
import type { Pluggable } from 'unified'
import type { PluginOption } from 'vite'
import type { Awaitable, NibPlugin, NibVitePluginContext } from './plugin'

export interface PageMeta {
  title?: string
  description?: string
  draft?: boolean
  head?: HeadContribution
}

export type HeadTagName = 'meta' | 'link' | 'script' | 'style'
export type HeadAttributeValue = string | number | boolean

/** A structured document-head element rendered by Nib with escaped attributes. */
export interface HeadElement {
  readonly tag: HeadTagName
  readonly attributes?: Readonly<Record<string, HeadAttributeValue>>
  readonly content?: string
}

/** Site- or page-owned additions to the generated document head. */
export interface HeadContribution {
  readonly elements?: readonly HeadElement[]
}

export interface MarkdownSourceContext {
  /** Absolute or project-relative source path exposed to Unified plugins. */
  readonly file: string
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

export interface PageSourcePage {
  path?: string
  /** Stable collection identity when one input expands into multiple routes. */
  collectionId?: string
  data: unknown
  meta?: PageMeta
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

export type AnyCollectionDefinition<
  Validator extends DataValidator = DataValidator,
> = CollectionDefinition<Validator> | PageSourceCollectionDefinition<Validator>

export interface MarkdownDefinition<
  Validator extends DataValidator = DataValidator,
> {
  schema?: SchemaValidator<Validator>
  validate?: Validator extends DataSchema<unknown>
    ? never
    : (value: unknown) => InferDataValidator<Validator>
  /** Unified remark plugins, applied after Nib's GFM parser. */
  remarkPlugins?: readonly Pluggable[]
  /**
   * Keep raw HTML nodes for trusted, application-owned content. The default
   * remains false so Markdown cannot introduce arbitrary HTML by accident.
   */
  allowDangerousHtml?: boolean
  /** Unified rehype plugins, applied before HTML serialization. */
  rehypePlugins?: readonly Pluggable[]
}

export interface SiteConfig {
  title: string
  /** Canonical deployed origin, shared by feeds, sitemaps, and future document metadata. */
  origin?: string
  description?: string
  titleTemplate?: string
  navigation?: Array<{ label: string; href: string }>
  head?: HeadContribution
}

export type TrailingSlash = 'always' | 'never' | 'ignore'
export type RedirectStatus = 301 | 302 | 307 | 308

export type NibHostingAdapter = 'netlify' | 'vercel' | 'cloudflare' | 's3'

export interface NibHostingConfig {
  /** Generate deploy-specific companions from the publication manifest. */
  readonly adapters?: readonly NibHostingAdapter[]
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
  site: SiteConfig
  trailingSlash?: TrailingSlash
  hosting?: NibHostingConfig
  redirects?: Readonly<Record<string, RedirectDefinition>>
  vite?: NibViteConfig
  plugins?: readonly NibPlugin[]
  shell?: ComponentType<SiteShellProps<any>>
  markdown?: MarkdownDefinition<any>
  pageSources?: readonly PageSourceDefinition<any>[]
  collections?: Record<string, AnyCollectionDefinition<any>>
}

export type CollectionData<Definition> =
  Definition extends CollectionDefinition<infer Validator>
    ? InferDataValidator<Validator>
    : Definition extends PageSourceCollectionDefinition<infer Validator>
      ? InferDataValidator<Validator>
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

export interface PageProps<Config extends NibConfig = NibConfig> {
  /** Stable public facts about the route being rendered. */
  route: PageRoute
  site: SiteConfig
  collections: LoadedCollections<Config>
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
}

export interface SiteShellProps<
  Config extends NibConfig = NibConfig,
> extends PageProps<Config> {
  children: ReactNode
}

/** Metadata after Nib has applied site defaults and title templates. */
export type ResolvedPageMeta = Readonly<Required<Pick<PageMeta, 'title' | 'description'>> & PageMeta>

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
  /** @internal Defaults to the generated public path without leading slashes. */
  collectionId?: string
}

export interface ResolvedPageRoute extends PageRoute {
  component: ComponentType<any>
  data?: unknown
  frontmatter?: unknown
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
