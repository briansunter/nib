import type { ComponentType, ReactNode } from 'react'
import type { NibPlugin } from './plugin'

export interface PageMeta {
  title?: string
  description?: string
  draft?: boolean
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
  data: unknown
  meta?: PageMeta
  layout?: string
}

export interface PageSourceDefinition<
  Validator extends DataValidator = DataValidator,
> {
  extensions: readonly string[]
  match?: (file: string) => boolean
  schema?: SchemaValidator<Validator>
  validate?: Validator extends DataSchema<unknown>
    ? never
    : (value: unknown, context: PageSourceContext) => InferDataValidator<Validator>
  load: (
    context: PageSourceContext,
  ) => PageSourcePage | PageSourcePage[] | Promise<PageSourcePage | PageSourcePage[]>
  component: ComponentType<DataPageProps<InferDataValidator<Validator>, any>>
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

export interface MarkdownDefinition<
  Validator extends DataValidator = DataValidator,
> {
  schema?: SchemaValidator<Validator>
  validate?: Validator extends DataSchema<unknown>
    ? never
    : (value: unknown) => InferDataValidator<Validator>
}

export interface SiteConfig {
  title: string
  description?: string
  titleTemplate?: string
  navigation?: Array<{ label: string; href: string }>
}

export interface NibConfig {
  base?: string
  site: SiteConfig
  plugins?: readonly NibPlugin[]
  shell?: ComponentType<SiteShellProps<any>>
  markdown?: MarkdownDefinition<any>
  pageSources?: readonly PageSourceDefinition<any>[]
  collections?: Record<string, CollectionDefinition<any>>
}

export type CollectionData<Definition> =
  Definition extends CollectionDefinition<infer Validator>
    ? InferDataValidator<Validator>
    : never

export type LoadedCollections<Config extends NibConfig> =
  Config extends { collections: infer Definitions }
    ? LoadedCollectionDefinitions<Definitions>
    : Record<string, never>

export type LoadedCollectionDefinitions<Definitions> = {
  [Name in keyof Definitions]:
    Definitions[Name] extends CollectionDefinition<any>
      ? Array<CollectionEntry<CollectionData<Definitions[Name]>>>
      : never
}

export interface PageProps<Config extends NibConfig = NibConfig> {
  route: ResolvedRoute
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
}

export interface ResolvedRoute {
  path: string
  component: ComponentType<any>
  meta: Required<Pick<PageMeta, 'title' | 'description'>> & PageMeta
  source: string
  status: number
  data?: unknown
  frontmatter?: unknown
  layouts: ComponentType<any>[]
}

export interface RenderedPage {
  status: number
  head: string
  html: string
  islands: string[]
}
