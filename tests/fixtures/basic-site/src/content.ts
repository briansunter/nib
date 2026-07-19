import { defineCollection, defineMarkdown, glob, z } from '@briansunter/nib'
import { parse as parseYaml } from 'yaml'

export const markdownSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  draft: z.boolean().optional(),
  layout: z.string().optional(),
  eyebrow: z.string(),
})

export type MarkdownFrontmatter = z.infer<typeof markdownSchema>

export const markdown = defineMarkdown({
  schema: markdownSchema,
})

export const posts = defineCollection({
  loader: glob({
    base: 'src/content/posts',
    pattern: '**/*.yaml',
    load: ({ source }) => parseYaml(source),
  }),
  schema: z.object({
    title: z.string(),
    published: z.coerce.date(),
  }),
})
