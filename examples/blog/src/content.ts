import {
  defineCollection,
  defineDerivedPages,
  defineMarkdown,
  fromCollection,
  fromMarkdownPages,
  z,
  type PageDescriptor,
} from '@briansunter/nib'
import { jsonFile } from '@briansunter/nib/server'
import { TopicPage } from './data-pages'

export const blogFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  image: z.string().optional(),
  type: z.enum(['website', 'article']).default('article'),
})

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>

export const blogMarkdown = defineMarkdown({
  schema: blogFrontmatterSchema,
})

function frontmatter(page: PageDescriptor): BlogFrontmatter {
  return blogFrontmatterSchema.parse(page.frontmatter)
}

export const posts = fromMarkdownPages({
  match: (page) => page.path.startsWith('/posts/') && page.path !== '/posts/',
  id: (page) => page.path.split('/').filter(Boolean).at(-1) ?? page.path,
  select: (page) => {
    const data = frontmatter(page)
    return {
      title: data.title,
      description: data.description,
      date: data.date.toISOString().slice(0, 10),
      tags: data.tags,
      path: page.path,
    }
  },
  sort: (left, right) => (
    frontmatter(right).date.valueOf() - frontmatter(left).date.valueOf()
  ),
})

export const topicSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  description: z.string(),
})

export type Topic = z.infer<typeof topicSchema>

export const topics = defineCollection(jsonFile({
  file: 'src/pages/topics/page.json',
  schema: topicSchema,
  id: (topic) => topic.slug,
}))

// Topics are a deterministic projection of the topics collection: one derived
// route per entry, generated after the collection loads.
export const topicPages = defineDerivedPages({
  pages: fromCollection(topics, (entries) => entries.map(({ data: topic }) => ({
    path: `/topics/${topic.slug}/`,
    data: topic,
    meta: { title: topic.title, description: topic.description },
  }))),
  component: TopicPage,
})
