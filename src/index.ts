export { defineConfig } from './framework/config'
export { createBuildCache, cacheKey } from './framework/cache'
export {
  defineDataPage,
  defineLayout,
  definePage,
} from './framework/authoring'
export {
  defineCollection,
  defineMarkdown,
  definePageSource,
  defineDerivedPages,
  fromPageSource,
  fromMarkdownPages,
  fromPages,
  fromCollection,
  pageRenderer,
} from './framework/content'
// Compatibility exports. Prefer @briansunter/nib/server for filesystem loaders.
export { file, glob } from './framework/content-compat'
export { island } from './framework/islands'
export { Behavior } from './framework/behaviors'
export { markdownMedia } from './integrations/markdown-media'
export { buildInfo } from './integrations/build-info'
export {
  Content,
  isMarkdownContent,
  markdownBody,
} from './framework/markdown-content'
export { metadata } from './integrations/metadata'
export { siteMetadata } from './integrations/site-metadata'
export { search } from './integrations/search'
export { siteHref } from './framework/urls'
export { z } from 'zod'
export type {
  FileLoaderOptions,
  GlobLoaderFile,
  GlobLoaderOptions,
} from './framework/content-compat'
export type {
  BehaviorProps,
  BehaviorDeferStrategy,
} from './framework/behaviors'
export type {
  HydrationStrategy,
  IslandControlProps,
  IslandDefinition,
} from './framework/islands'
export type {
  NibBuildOutput,
  StagedDirectory,
} from './framework/types'
export type { CacheEntryOptions, NibBuildCache } from './framework/cache'
export type {
  CollectionDefinition,
  CollectionCapability,
  PageSourceCollectionDefinition,
  PageCollectionDefinition,
  PageDescriptor,
  CollectionEntry,
  CollectionLoaderContext,
  CollectionLoaderResult,
  DataPageProps,
  DerivedPage,
  DerivedPagesDefinition,
  DataSchema,
  DataValidator,
  HeadAttributeValue,
  HeadContribution,
  HeadElement,
  HeadTagName,
  InferDataValidator,
  LoadedCollectionDefinitions,
  LoadedCollections,
  MarkdownDefinition,
  MarkdownMetaContext,
  MarkdownSourceContext,
  MetadataImage,
  NibConfig,
  NibHostingAdapter,
  NibHostingAdapterConfig,
  NibHostingConfig,
  NibViteConfig,
  PageLayoutProps,
  PageRoute,
  PageMeta,
  PageProps,
  PageSourceContext,
  PageSourceRenderer,
  PageSourceDefinition,
  PageSourcePage,
  RedirectDefinition,
  RedirectStatus,
  RedirectRoute,
  ResolvedPageMeta,
  ResourceRoute,
  RouteSnapshot,
  SiteShellProps,
  SiteConfigFor,
  TrailingSlash,
} from './framework/types'
export type {
  ContentProps,
  ContentRenderer,
  ContentRootProps,
  ContentRootTag,
  MarkdownBodyOptions,
  MarkdownContent,
} from './framework/markdown-content'
export type {
  PublicationManifest,
  PublicationManifestRoute,
} from './framework/publication'
export type { MetadataOptions } from './integrations/metadata'
export type { SiteMetadataOptions } from './integrations/site-metadata'
export type { MarkdownMediaOptions } from './integrations/markdown-media'
export type { SearchItem, SearchItems, SearchOptions } from './integrations/search'
