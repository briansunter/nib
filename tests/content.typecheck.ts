import {
  defineCollection,
  defineMarkdown,
  definePageSource,
  type NibConfig,
  type PageLayoutProps,
  z,
} from '@briansunter/nib'

const schema = z.object({ value: z.string() })

defineMarkdown({ schema })
defineMarkdown({ validate: (value) => value })
definePageSource({
  extensions: ['data'],
  schema,
  load: () => ({ data: { value: 'ok' } }),
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
