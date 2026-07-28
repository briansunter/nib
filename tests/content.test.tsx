import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  compileDataPages,
  defineCollection,
  definePageSource,
  fromPageSource,
  fromMarkdownPages,
  fromPages,
  pageRenderer,
  pageSourceExtensions,
  pageSourceIndex,
  pageSourcePatterns,
} from '../src/framework/content'
import { file, glob, loadCollections } from '../src/framework/content-server'
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

  it('loads a deferred renderer once and reuses compiled entries as a collection', async () => {
    let rendererLoads = 0
    const source = definePageSource({
      extensions: ['data'],
      schema: itemSchema,
      load: () => ({ data: { slug: 'one', count: 1 } }),
      component: pageRenderer(async () => {
        rendererLoads += 1
        return { default: ItemPage }
      }),
    })
    const context = {
      file: 'src/pages/items/page.data',
      source: 'one',
      defaultPath: '/items/one',
    }
    const [first] = await compileDataPages(source, context)
    const [second] = await compileDataPages(source, context)
    expect(rendererLoads).toBe(1)
    expect(first?.component).toBe(second?.component)
    const collections = await loadCollections(
      { items: fromPageSource(source) },
      process.cwd(),
      new Map([[source, [{ id: first!.collectionId!, data: first!.data }]]]),
    )
    expect(collections.items).toEqual([{ id: 'items/one', data: { slug: 'one', count: 1 } }])
  })

  it('derives deterministic immutable collections from validated pages', async () => {
    const descriptors = [
      Object.freeze({
        path: '/notes/second',
        source: '/src/pages/notes/second/page.md',
        meta: Object.freeze({ title: 'Second', description: '' }),
        frontmatter: Object.freeze({ slug: 'second', draft: false }),
        data: undefined,
      }),
      Object.freeze({
        path: '/projects/one',
        source: '/src/pages/projects/page.json#0',
        meta: Object.freeze({ title: 'Project', description: '' }),
        frontmatter: undefined,
        data: Object.freeze({ slug: 'project' }),
      }),
      Object.freeze({
        path: '/notes/first',
        source: '/src/pages/notes/first/page.md',
        meta: Object.freeze({ title: 'First', description: '' }),
        frontmatter: Object.freeze({ slug: 'first', draft: false }),
        data: undefined,
      }),
    ]
    const notes = fromMarkdownPages({
      match: (page) => page.path.startsWith('/notes/'),
      id: (page) => (page.frontmatter as { slug: string }).slug,
      select: (page) => ({
        title: page.meta.title,
        path: page.path,
      }),
    })
    const allPages = fromPages({
      match: () => true,
      id: (page) => page.path,
      select: (page) => page.source,
    })
    const collections = await loadCollections(
      { notes, allPages },
      process.cwd(),
      new Map(),
      descriptors,
    )
    expect(collections.notes).toEqual([
      { id: 'second', data: { title: 'Second', path: '/notes/second' } },
      { id: 'first', data: { title: 'First', path: '/notes/first' } },
    ])
    expect(collections.allPages).toHaveLength(3)
    expect(Object.isFrozen(collections)).toBe(true)
    expect(Object.isFrozen(collections.notes)).toBe(true)
    expect(Object.isFrozen(collections.notes[0])).toBe(true)
    expect(Object.isFrozen(collections.notes[0]?.data)).toBe(true)

    const duplicateIds = fromPages({
      match: () => true,
      id: () => 'same',
      select: (page) => page.path,
    })
    await expect(loadCollections(
      { duplicateIds },
      process.cwd(),
      new Map(),
      descriptors,
    )).rejects.toThrow('Duplicate collection entry duplicateIds/same')
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
    expect(() => pageSourceExtensions([
      {
        extensions: ['yaml'],
        load: async () => ({ data: {} }),
        component: pageRenderer('./src/data-pages', 'not-an-export!'),
      },
    ])).toThrow('exportName')
  })

  it('collects explicit source patterns without changing nested page matching', () => {
    const definitions = [{
      extensions: ['json'],
      patterns: ['/src/content/projects.json', '/src/content/projects.json'],
      load: async () => ({ data: {} }),
      component: ItemPage,
    }]
    expect(pageSourceExtensions(definitions)).toEqual(['.json'])
    expect(pageSourcePatterns(definitions)).toEqual(['/src/content/projects.json'])
    expect(pageSourceIndex(definitions, '.json', '/src/content/projects.json')).toBe(0)
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
      extensions: ['json', 'yaml'],
      schema: itemSchema,
      load: () => ({ data: { slug: 'one', count: 1 } }),
      component: pageRenderer('./src/data-pages', 'ItemPage'),
    })
    const plugin = nibDataPages('/site/nib.config.ts', [source])
    if (typeof plugin.configResolved !== 'function') {
      throw new Error('Data page plugin has no configResolved hook')
    }
    if (typeof plugin.resolveId !== 'function') throw new Error('Data page plugin has no resolve hook')
    if (typeof plugin.load !== 'function') throw new Error('Data page plugin has no load hook')
    const configResolved = plugin.configResolved as (config: { root: string }) => void
    const resolveId = plugin.resolveId as (id: string) => string | null
    const load = plugin.load as (id: string) => Promise<unknown>
    configResolved({ root: process.cwd() })
    const yamlFile = path.resolve('tests/fixtures/basic-site/src/pages/team/page.yaml')
    expect(resolveId(yamlFile)).toBeNull()
    expect(await load(yamlFile)).toBeNull()
    expect(resolveId(`${yamlFile}?raw`)).toBeNull()
    expect(await load(`${yamlFile}?raw`)).toBeNull()
    const yamlId = resolveId(`${yamlFile}?import&nib-page-source&lang.yaml`)
    expect(yamlId).toMatch(/^\0nib:page-source:/)
    const result = await load(yamlId!)

    // Generated data-page modules must advertise a JS module type so Vite 8
    // does not guess JSON from a `.json`/`.yaml` source extension and skip
    // import analysis for the virtual:nib/page-sources import.
    expect(result).toEqual(expect.objectContaining({ moduleType: 'js' }))
    const code = (result as { code: string }).code
    expect(code).toContain('compileDataPages(pageSources[0]')
    expect(code).toContain('virtual:nib/page-sources')
    expect(code).toContain('import { ItemPage as __nibPageRenderer } from "/site/src/data-pages"')
    expect(code).toContain(', __nibPageRenderer)')
    expect(code).toContain('defaultPath: "/team"')

    const jsonRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-content-json-page-'))
    temporaryDirectories.push(jsonRoot)
    const jsonFile = path.join(jsonRoot, 'projects.json')
    await fs.writeFile(jsonFile, '{"slug":"json-project","count":2}')
    const jsonResult = await load(`${jsonFile}?nib-page-source`)
    expect(jsonResult).toEqual(expect.objectContaining({ moduleType: 'js' }))
    expect((jsonResult as { code: string }).code).toContain('virtual:nib/page-sources')

    const sourceModule = await load('\0virtual:nib/page-sources')
    expect(sourceModule).toContain('configuredPageSources(config)')
    expect(sourceModule).not.toContain('setup')
  })
})
