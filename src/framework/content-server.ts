import fs from 'node:fs/promises'
import path from 'node:path'
import { glob as findFiles } from 'tinyglobby'
import { parseData, validateDataDefinition } from './content'
import { deepFreeze } from './freeze'
import type {
  CollectionDefinition,
  CollectionEntry,
  CollectionLoaderContext,
  CollectionLoaderResult,
  DataSchema,
  LoadedCollectionDefinitions,
  PageSourceCollectionDefinition,
  PageSourceDefinition,
  PageCollectionDefinition,
  PageDescriptor,
} from './types'

function collectionEntries(result: CollectionLoaderResult): Array<{ id: string; data: unknown }> {
  return Array.isArray(result)
    ? result
    : Object.entries(result).map(([id, data]) => ({ id, data }))
}

async function safeProjectFile(root: string, file: string): Promise<string> {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, file)
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Content file escapes the project root: ${file}`)
  }
  return resolved
}

export async function loadCollections<
  const Definitions extends Record<
    string,
    CollectionDefinition<any> | PageSourceCollectionDefinition<any> | PageCollectionDefinition<any>
  >,
>(
  definitions: Definitions | undefined,
  root: string,
  pageSourceEntries: ReadonlyMap<PageSourceDefinition<any>, readonly CollectionEntry[]> = new Map(),
  pageDescriptors: readonly PageDescriptor[] = [],
): Promise<LoadedCollectionDefinitions<Definitions>> {
  const collections: Record<string, CollectionEntry[]> = {}
  const context: CollectionLoaderContext = {
    root,
    async read(file) {
      return fs.readFile(await safeProjectFile(root, file), 'utf8')
    },
  }

  for (const [name, definition] of Object.entries(definitions ?? {})) {
    if ('pages' in definition) {
      const pageDefinition = definition as PageCollectionDefinition
      const seen = new Set<string>()
      const matchedPages = pageDescriptors
        .filter((page) => !pageDefinition.markdownOnly || /\.md(?:#\d+)?$/.test(page.source))
        .filter(pageDefinition.match)
      if (pageDefinition.sort) matchedPages.sort(pageDefinition.sort)
      collections[name] = matchedPages
        .map((page) => {
          const id = pageDefinition.id(page)
          if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(`Collection ${name} page id must be a non-empty string`)
          }
          if (seen.has(id)) throw new Error(`Duplicate collection entry ${name}/${id}`)
          seen.add(id)
          return deepFreeze({ id, data: pageDefinition.select(page) })
        })
      continue
    }
    if ('source' in definition) {
      const entries = pageSourceEntries.get(definition.source) ?? []
      const seen = new Set<string>()
      collections[name] = entries.map((entry) => {
        if (seen.has(entry.id)) throw new Error(`Duplicate collection entry ${name}/${entry.id}`)
        seen.add(entry.id)
        return deepFreeze({ id: entry.id, data: entry.data })
      })
      continue
    }
    validateDataDefinition(definition, `Collection ${name}`)
    if (typeof definition.loader !== 'function') {
      throw new Error(`Collection ${name} must define a loader function`)
    }
    const seen = new Set<string>()
    const result = await definition.loader(context)
    collections[name] = collectionEntries(result).map((entry) => {
      if (typeof entry.id !== 'string' || entry.id.trim() === '') {
        throw new Error(`Collection ${name} entry id must be a non-empty string`)
      }
      if (seen.has(entry.id)) {
        throw new Error(`Duplicate collection entry ${name}/${entry.id}`)
      }
      seen.add(entry.id)
      return deepFreeze({
        id: entry.id,
        data: parseData(entry.data, {
          ...(definition.schema ? { schema: definition.schema as DataSchema } : {}),
          ...(definition.validate
            ? { validate: (value) => definition.validate?.(value, { id: entry.id }) }
            : {}),
          label: `Collection ${name}/${entry.id}`,
        }),
      })
    })
  }

  for (const [name, entries] of Object.entries(collections)) {
    collections[name] = deepFreeze(entries) as CollectionEntry[]
  }
  return Object.freeze(collections) as LoadedCollectionDefinitions<Definitions>
}

export interface GlobLoaderFile {
  id: string
  file: string
  source: string
}

export interface GlobLoaderOptions {
  base: string
  pattern: string | string[]
  load(file: GlobLoaderFile): unknown | Promise<unknown>
}

export function glob(options: GlobLoaderOptions) {
  return async ({ root }: CollectionLoaderContext): Promise<CollectionLoaderResult> => {
    const base = await safeProjectFile(root, options.base)
    const files = await findFiles(options.pattern, {
      cwd: base,
      onlyFiles: true,
    })
    return Promise.all(files.sort().map(async (relativeFile: string) => {
      const file = path.posix.join(options.base.replaceAll('\\', '/'), relativeFile)
      const extension = path.posix.extname(relativeFile)
      const id = relativeFile.slice(0, extension ? -extension.length : undefined)
      return {
        id,
        data: await options.load({
          id,
          file,
          source: await fs.readFile(path.join(base, relativeFile), 'utf8'),
        }),
      }
    }))
  }
}

export interface FileLoaderOptions {
  file: string
  load(source: string): CollectionLoaderResult | Promise<CollectionLoaderResult>
}

export function file(options: FileLoaderOptions) {
  return async (context: CollectionLoaderContext): Promise<CollectionLoaderResult> => (
    options.load(await context.read(options.file))
  )
}
