import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  compileDataPages,
  defineCollection,
  definePageSource,
  file,
  glob,
  loadCollections,
  pageSourceExtensions,
  pageSourceIndex,
} from '../src/framework/content'
import type { DataPageProps } from '../src/framework/types'
import { nibDataPages } from '../src/framework/vite-plugin'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

const itemSchema = z.object({
  slug: z.string(),
  count: z.coerce.number(),
})

function ItemPage({ data }: DataPageProps<z.infer<typeof itemSchema>>) {
  return <p>{data.slug}: {data.count}</p>
}

describe('generic content', () => {
  it('validates and expands one source file into multiple typed pages', async () => {
    const source = definePageSource({
      extensions: ['csv'],
      schema: itemSchema,
      load: () => [
        { path: '/items/one/', data: { slug: 'one', count: '1' } },
        { path: '/items/two/', data: { slug: 'two', count: '2' } },
      ],
      component: ItemPage,
    })

    const pages = await compileDataPages(source, {
      file: 'src/pages/items/page.csv',
      source: 'slug,count\none,1\ntwo,2',
      defaultPath: '/items',
    })

    expect(pages.map((page) => page.path)).toEqual(['/items/one', '/items/two'])
    expect(pages.map((page) => page.data)).toEqual([
      { slug: 'one', count: 1 },
      { slug: 'two', count: 2 },
    ])
  })

  it('supports a custom validator and default folder route', async () => {
    const source = definePageSource({
      extensions: ['data'],
      validate(value) {
        if (typeof value !== 'string') throw new Error('expected a string')
        return value.toUpperCase()
      },
      load: ({ source: contents }) => ({ data: contents }),
      component: ({ data }: DataPageProps<string>) => <p>{data}</p>,
    })

    const [page] = await compileDataPages(source, {
      file: 'src/pages/message/page.data',
      source: 'hello',
      defaultPath: '/message',
    })
    expect(page.path).toBe('/message')
    expect(page.data).toBe('HELLO')
  })

  it('rejects ambiguous matches and unsafe page source configuration', () => {
    const overlapping = [
      {
        extensions: ['yaml'],
        load: async () => ({ data: {} }),
        component: ItemPage,
      },
      {
        extensions: ['.YAML'],
        load: async () => ({ data: {} }),
        component: ItemPage,
      },
    ]
    expect(pageSourceExtensions(overlapping)).toEqual(['.yaml'])
    expect(() => pageSourceIndex(overlapping, '.yaml', '/src/pages/team/page.yaml'))
      .toThrow('Multiple page sources match')
    expect(() => pageSourceExtensions([
      {
        extensions: ['../yaml'],
        load: async () => ({ data: {} }),
        component: ItemPage,
      },
    ])).toThrow('letters and numbers')
  })

  it('rejects ambiguous validators before loading content', async () => {
    const source = {
      extensions: ['data'],
      schema: { parse: (value: unknown) => value },
      validate: (value: unknown) => value,
      load: async () => ({ data: 'value' }),
      component: ItemPage,
    }
    await expect(compileDataPages(source as never, {
      file: 'src/pages/item/page.data',
      source: 'value',
      defaultPath: '/item',
    })).rejects.toThrow('either schema or validate')
  })

  it('loads schema-validated collections from glob and file loaders', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-content-'))
    temporaryDirectories.push(root)
    await fs.mkdir(path.join(root, 'content/posts'), { recursive: true })
    await fs.writeFile(
      path.join(root, 'content/posts/hello.json'),
      '{"title":"Hello","published":"2026-07-18"}',
    )
    await fs.writeFile(
      path.join(root, 'content/authors.json'),
      '{"ada":{"name":"Ada"}}',
    )

    const collections = await loadCollections({
      posts: defineCollection({
        loader: glob({
          base: 'content/posts',
          pattern: '**/*.json',
          load: ({ source }) => JSON.parse(source),
        }),
        schema: z.object({
          title: z.string(),
          published: z.coerce.date(),
        }),
      }),
      authors: defineCollection({
        loader: file({
          file: 'content/authors.json',
          load: JSON.parse,
        }),
        schema: z.object({ name: z.string() }),
      }),
    }, root)

    expect(collections.posts[0].id).toBe('hello')
    expect(collections.posts[0].data.published).toEqual(new Date('2026-07-18'))
    expect(collections.authors).toEqual([{ id: 'ada', data: { name: 'Ada' } }])
  })

  it('generates a watched Vite module for configured data extensions', async () => {
    const source = definePageSource({
      extensions: ['yaml'],
      schema: itemSchema,
      load: () => ({ data: { slug: 'one', count: 1 } }),
      component: ItemPage,
    })
    const plugin = nibDataPages('/site/nib.config.ts', [source])
    if (typeof plugin.load !== 'function') throw new Error('Data page plugin has no load hook')
    const load = plugin.load as (id: string) => Promise<unknown>
    const result = await load(path.resolve(
      'tests/fixtures/basic-site/src/pages/team/page.yaml',
    ))

    expect(result).toContain('compileDataPages(config.pageSources[0]')
    expect(result).toContain('defaultPath: "/team"')
  })
})
