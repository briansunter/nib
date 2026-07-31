import {
  defineCollection,
  defineMarkdown,
  definePageSource,
  fromMarkdownPages,
  type CollectionEntry,
  type NibConfig,
  type PageCollectionDefinition,
  type PageLayoutProps,
  type SiteConfigFor,
  type SiteShellProps,
  z,
} from '@briansunter/nib'

const schema = z.object({ value: z.string() })

defineMarkdown({ schema })
defineMarkdown({ validate: (value) => value })
definePageSource({
  extensions: ['data'],
  schema,
  load: () => ({ data: { value: 'ok' }, meta: { title: 'Value' } }),
  component: () => null,
})
defineCollection({
  loader: async () => [],
  schema,
})

function Layout({ data, frontmatter }: PageLayoutProps<
  { title: string },
  NibConfig,
  { id: string }
>) {
  frontmatter?.title
  data?.id
  return null
}

void Layout

// A content definition has one validation adapter, not two competing ones.
// @ts-expect-error schema and validate are mutually exclusive
defineMarkdown({ schema, validate: (value) => value })
// @ts-expect-error schema and validate are mutually exclusive
definePageSource({
  extensions: ['data'],
  schema,
  validate: (value) => value,
  load: () => ({ data: { value: 'ok' } }),
  component: () => null,
})
// @ts-expect-error schema and validate are mutually exclusive
defineCollection({
  loader: async () => [],
  schema,
  validate: (value) => value,
})

// 1. fromMarkdownPages(markdown, options) infers frontmatter from the supplied
//    markdown definition's schema, so match/id/select callbacks are typed.
const inferenceMarkdown = defineMarkdown({
  schema: z.object({
    title: z.string(),
    tags: z.array(z.string()),
  }),
})

const inferredCollection = fromMarkdownPages(inferenceMarkdown, {
  match: (page) => Boolean(page.frontmatter),
  id: (page) => page.path,
  select: (page) => {
    const title: string | undefined = page.frontmatter?.title
    const tags: string[] | undefined = page.frontmatter?.tags
    return { slug: page.path, title, tags }
  },
})

// The inferred Frontmatter carries { title: string; tags: string[] } and the
// Selected shape is preserved, rather than collapsing to unknown.
type InferredCollectionShape =
  typeof inferredCollection extends PageCollectionDefinition<
    infer InferredFrontmatter,
    infer Selected
  >
    ? InferredFrontmatter extends { title: string; tags: string[] }
      ? Selected extends {
          slug: string
          title: string | undefined
          tags: string[] | undefined
        }
        ? true
        : false
      : false
    : false
const _okInferredFrontmatter: true = null as unknown as InferredCollectionShape
void _okInferredFrontmatter

// 2. The single-arg fromMarkdownPages(options) overload stays backward
//    compatible: with no markdown definition, frontmatter is unknown.
const legacyCollection = fromMarkdownPages({
  match: () => true,
  id: (page) => page.path,
  select: (page) => ({ slug: page.path, title: page.meta.title }),
})

type LegacyFrontmatterIsUnknown =
  typeof legacyCollection extends PageCollectionDefinition<infer Frontmatter, any>
    ? unknown extends Frontmatter
      ? true
      : false
    : false
const _okLegacyFrontmatterUnknown: true = null as unknown as LegacyFrontmatterIsUnknown
void _okLegacyFrontmatterUnknown

fromMarkdownPages({
  match: () => true,
  id: (page) => page.path,
  select: (page) => {
    // @ts-expect-error frontmatter is unknown; property access is rejected
    page.frontmatter?.title
    return page.path
  },
})

// 3. SiteConfigFor produces a config whose collections are typed entries,
//    mirroring the blog's `defineConfig({ collections: { ... } })` usage.
const collections = {
  writing: fromMarkdownPages({
    match: () => true,
    id: (page) => page.path,
    select: (page) => ({ slug: page.path, title: page.meta.title }),
  }),
} as const

type CollectionsConfig = SiteConfigFor<typeof collections>
type WritingEntries = SiteShellProps<CollectionsConfig>['collections']['writing']

// collections.writing resolves to an array of CollectionEntry<{ slug; title }>,
// never `any`.
type WritingEntryIsTyped =
  WritingEntries extends ReadonlyArray<CollectionEntry<{ slug: string; title: string }>>
    ? true
    : false
const _okWritingEntryTyped: true = null as unknown as WritingEntryIsTyped
void _okWritingEntryTyped

// The entry data flows concretely: slug is a string, not `any`.
type WritingSlugIsString =
  WritingEntries extends ReadonlyArray<CollectionEntry<infer Data>>
    ? Data extends { slug: infer Slug }
      ? Slug extends string
        ? true
        : false
      : false
    : false
const _okWritingSlugIsString: true = null as unknown as WritingSlugIsString
void _okWritingSlugIsString
