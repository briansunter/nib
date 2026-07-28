import { defineCollection, defineMarkdown, file, z } from '@briansunter/nib'
import { parse as parseYaml } from 'yaml'
import { rehypePlugins, remarkPlugins } from './lib/markdown-plugins'

function parseJson<T>(source: string, label: string): T {
  try {
    return JSON.parse(source) as T
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`${label}: ${detail}`)
  }
}

// Writing entries are emitted as root-level page.md routes by the import
// script; this collection is the metadata mirror consumed by the archive,
// home page, RSS, and search.
export const writingSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().default(''),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  cover: z.string().nullable().default(null),
  lastMod: z.coerce.date().nullable().default(null),
  math: z.boolean().default(false),
  wordCount: z.number().int().nonnegative().default(0),
})
export type Writing = z.infer<typeof writingSchema>

export const writing = defineCollection({
  loader: file({
    file: 'src/content/writing.json',
    load(source) {
      const entries = parseJson<Writing[]>(source, 'writing.json')
      return entries.map((entry) => ({ id: entry.slug, data: entry }))
    },
  }),
  schema: writingSchema,
})

export const projectSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().default(''),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  cover: z.string().nullable(),
  coverFile: z.string().nullable(),
  projectUrl: z.string().url().optional(),
  github: z.string().url().optional(),
  bodyHtml: z.string().default(''),
})
export type Project = z.infer<typeof projectSchema>

export const ingredientSchema = z.object({
  type: z.literal('ingredient'),
  name: z.string(),
  quantity: z.union([z.number(), z.string()]),
  units: z.string(),
})
export type Ingredient = z.infer<typeof ingredientSchema>

const cookwareSchema = z.object({
  type: z.literal('cookware'),
  name: z.string(),
  quantity: z.union([z.number(), z.string()]),
})

const stepItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), value: z.string() }),
  ingredientSchema,
  cookwareSchema,
  z.object({
    type: z.literal('timer'),
    quantity: z.union([z.number(), z.string()]),
    units: z.string(),
  }),
])

const recipeBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('step'), items: z.array(stepItemSchema) }),
  z.object({ type: z.literal('note'), text: z.string() }),
  z.object({ type: z.literal('section'), name: z.string() }),
])

const recipeMetadataSchema = z.looseObject({
  title: z.string(),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  servings: z.string().optional(),
  source: z.string().optional(),
  cuisine: z.string().optional(),
  difficulty: z.string().optional(),
  time: z.string().optional(),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  totalTime: z.string().optional(),
  longDescription: z.string().optional(),
  rating: z.union([z.number(), z.string()]).optional(),
  author: z.string().optional(),
  url: z.string().optional(),
})

export const recipeSchema = z.object({
  slug: z.string(),
  metadata: recipeMetadataSchema,
  ingredients: z.array(ingredientSchema),
  cookwares: z.array(cookwareSchema),
  steps: z.array(z.array(stepItemSchema)),
  blocks: z.array(recipeBlockSchema),
  cooklang: z.string(),
})
export type Recipe = z.infer<typeof recipeSchema>

export const tagPageSchema = z.object({
  tag: z.string(),
  display: z.string(),
  count: z.number(),
  entries: z.array(writingSchema),
})
export type TagPage = z.infer<typeof tagPageSchema>

export const artworkSchema = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
  medium: z.string().default(''),
  dimensions: z.string().default(''),
  surface: z.string().default(''),
  location: z.string().default(''),
  date: z.string().default(''),
  tags: z.array(z.string()).default([]),
  image: z.string().nullable(),
})
export const artCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  default: z.boolean().default(false),
  date: z.string(),
  medium: z.string().default(''),
  tags: z.array(z.string()).default([]),
  cover: z.string().nullable(),
  artworks: z.array(artworkSchema),
})
export type ArtCollection = z.infer<typeof artCollectionSchema>

export const photoSchema = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  image: z.string().nullable(),
})
export const photoCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  location: z.string().default(''),
  date: z.string(),
  gps: z.object({ lat: z.number(), lng: z.number() }).optional(),
  tags: z.array(z.string()).default([]),
  cover: z.string().nullable(),
  photos: z.array(photoSchema),
})
export type PhotoCollection = z.infer<typeof photoCollectionSchema>

export const pinSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  image: z.string().nullable(),
  dateAcquired: z.string().default(''),
  acquiredAt: z.string().default(''),
  gps: z.object({ lat: z.number(), lng: z.number() }).optional(),
  source: z.string().default(''),
  category: z.string().default(''),
  tags: z.array(z.string()).default([]),
  maker: z.string().default(''),
  favorite: z.boolean().default(false),
})
export const pinCollectionSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  pins: z.array(pinSchema),
})
export type PinCollection = z.infer<typeof pinCollectionSchema>

export const travelSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  visitedCountries: z.array(z.string()).default([]),
  visitedUsStates: z.array(z.string()).default([]),
  visitedChinaProvinces: z.array(z.string()).default([]),
  cities: z.array(z.object({
    id: z.string(),
    name: z.string(),
    countryCode: z.string(),
    stateCode: z.string().optional(),
    provinceCode: z.string().optional(),
    gps: z.object({ lat: z.number(), lng: z.number() }),
    tags: z.array(z.string()).default([]),
  })),
})
export type Travel = z.infer<typeof travelSchema>

// Build-time galleries are loaded as plain JSON from generated snapshots.
export const art = defineCollection({
  loader: file({
    file: 'src/content/art.json',
    load: (source) => {
      const data = parseJson<ArtCollection[]>(source, 'art.json')
      return data.map((entry) => ({ id: entry.id, data: entry }))
    },
  }),
  schema: artCollectionSchema,
})

export const photos = defineCollection({
  loader: file({
    file: 'src/content/photos.json',
    load: (source) => {
      const data = parseJson<PhotoCollection[]>(source, 'photos.json')
      return data.map((entry) => ({ id: entry.id, data: entry }))
    },
  }),
  schema: photoCollectionSchema,
})

export const pins = defineCollection({
  loader: file({
    file: 'src/content/pins.json',
    load: (source) => {
      const parsed = parseJson<PinCollection>(source, 'pins.json')
      return [{ id: 'default', data: parsed }]
    },
  }),
  schema: pinCollectionSchema,
})

export const travel = defineCollection({
  loader: file({
    file: 'src/content/travel.json',
    load: (source) => [{ id: 'default', data: parseJson<Travel>(source, 'travel.json') }],
  }),
  schema: travelSchema,
})

export const markdown = defineMarkdown({
  // Match the canonical site's no-bare-URL-autolink behavior while keeping
  // the site-specific remark order explicit below.
  gfm: false,
  remarkPlugins,
  rehypePlugins,
  schema: z.looseObject({
    title: z.string().optional(),
    description: z.string().optional(),
    layout: z.string().optional(),
    date: z.coerce.date().optional(),
    tags: z.array(z.string()).optional(),
  }),
})

// Re-export parseYaml for the project page source's legacy YAML loader.
export { parseYaml }
