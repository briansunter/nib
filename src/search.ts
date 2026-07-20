import type {
  NibPlugin,
  NibResolvedPageRoute,
  NibRoutesPluginContext,
} from './framework/plugin'

export interface SearchItem {
  readonly title: string
  readonly description?: string
  readonly href: string
  readonly kind?: string
  readonly tags?: readonly string[]
  readonly text?: string
}

export type SearchItems =
  | readonly SearchItem[]
  | ((context: NibRoutesPluginContext) => readonly SearchItem[] | Promise<readonly SearchItem[]>)

export interface SearchOptions {
  /** Resource route containing the deterministic search index. */
  readonly path?: string
  /** Optional application-owned item provider; page routes are the fallback. */
  readonly items?: SearchItems
}

function pageRouteItem(route: NibResolvedPageRoute): SearchItem {
  return {
    title: route.meta.title,
    description: route.meta.description,
    href: route.path,
  }
}

function normalizeItem(value: SearchItem, index: number): SearchItem {
  if (value === null || typeof value !== 'object') {
    throw new Error(`Nib search item ${index} must be an object`)
  }
  if (typeof value.title !== 'string' || value.title.trim() === '') {
    throw new Error(`Nib search item ${index} title must be non-empty`)
  }
  if (
    typeof value.href !== 'string'
    || (!value.href.startsWith('/') && !/^https?:\/\//i.test(value.href))
  ) {
    throw new Error(`Nib search item ${index} href must be an absolute route or HTTP(S) URL`)
  }
  if (value.description !== undefined && typeof value.description !== 'string') {
    throw new Error(`Nib search item ${index} description must be a string`)
  }
  if (value.kind !== undefined && typeof value.kind !== 'string') {
    throw new Error(`Nib search item ${index} kind must be a string`)
  }
  if (value.text !== undefined && typeof value.text !== 'string') {
    throw new Error(`Nib search item ${index} text must be a string`)
  }
  if (
    value.tags !== undefined
    && (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== 'string'))
  ) {
    throw new Error(`Nib search item ${index} tags must contain strings`)
  }
  return {
    title: value.title,
    href: value.href,
    ...(value.description === undefined ? {} : { description: value.description }),
    ...(value.kind === undefined ? {} : { kind: value.kind }),
    ...(value.tags === undefined ? {} : { tags: [...value.tags] }),
    ...(value.text === undefined ? {} : { text: value.text }),
  }
}

/** Emits a static search resource route without shipping a search runtime. */
export function search(options: SearchOptions = {}): NibPlugin {
  const routePath = options.path ?? '/search.json'
  if (!routePath.startsWith('/') || routePath.includes('?') || routePath.includes('#')) {
    throw new Error('Nib search path must be an absolute route path without query or hash')
  }
  return {
    name: '@briansunter/nib-search',
    async routes(context) {
      const rawItems = options.items === undefined
        ? context.routes
            .filter((route): route is NibResolvedPageRoute => route.kind === 'page' && route.status < 400)
            .map(pageRouteItem)
        : typeof options.items === 'function'
          ? await options.items(context)
          : options.items
      const items = rawItems.map(normalizeItem)
      return {
        kind: 'resource',
        path: routePath,
        contentType: 'application/json; charset=utf-8',
        body: `${JSON.stringify({ version: 1, items })}\n`,
      }
    },
  }
}
