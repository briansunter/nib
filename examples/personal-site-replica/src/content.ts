import { defineCollection, defineMarkdown, glob, z } from '@briansunter/nib'
import { parse as parseYaml } from 'yaml'

export const projectSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  cover: z.string(),
  projectUrl: z.string().url().optional(),
  github: z.string().url().optional(),
})

export type Project = z.infer<typeof projectSchema>

export const postSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  cover: z.string().optional(),
})

export type Post = z.infer<typeof postSchema>

export const markdown = defineMarkdown({
  schema: z.looseObject({
    title: z.string().optional(),
    description: z.string().optional(),
    layout: z.string().optional(),
    date: z.coerce.date().optional(),
    tags: z.array(z.string()).optional(),
  }),
})

export const posts = defineCollection({
  loader: glob({
    base: 'src/content/posts',
    pattern: '*.yaml',
    load: ({ source }) => parseYaml(source),
  }),
  schema: postSchema,
})
