import {
  defineCollection,
  defineConfig,
  defineDataPage,
  defineLayout,
  definePage,
  type DataPageProps,
  type PageLayoutProps,
  type PageProps,
  z,
} from '../src/index'

const config = defineConfig({
  site: { title: 'Typed site' },
  collections: {
    posts: defineCollection({
      loader: async () => [],
      schema: z.object({ title: z.string() }),
    }),
  },
})

definePage<typeof config>(({ collections, route }: PageProps<typeof config>) => {
  collections.posts[0]?.data.title
  route.meta.title
  // @ts-expect-error public route metadata is immutable
  route.meta.title = 'Changed'
  // @ts-expect-error collection data remains schema-derived
  collections.posts[0]?.data.missing
  return null
})

definePage<typeof config>(({ site }: PageProps<typeof config>) => {
  // @ts-expect-error resolved site fields are immutable
  site.title = 'Changed'
  // @ts-expect-error resolved navigation is immutable
  site.navigation?.push({ label: 'Changed', href: '/' })
  // @ts-expect-error resolved navigation items are immutable
  if (site.navigation?.[0]) site.navigation[0].label = 'Changed'
  return null
})

defineDataPage<{ slug: string }, typeof config>((props: DataPageProps<
  { slug: string },
  typeof config
>) => {
  props.data.slug
  // @ts-expect-error data page props retain the declared data type
  props.data.missing
  return null
})

defineLayout<{ title: string }, typeof config, { id: number }>(
  (props: PageLayoutProps<{ title: string }, typeof config, { id: number }>) => {
    props.frontmatter?.title
    props.data?.id
    props.children
    // @ts-expect-error layout data remains distinct from frontmatter
    props.data?.title
    return null
  },
)

// The helpers are identity functions, so the returned components remain valid
// ordinary React components for Nib's generated page/layout modules.
void definePage
void defineDataPage
void defineLayout
