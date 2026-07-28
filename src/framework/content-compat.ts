import type {
  CollectionLoaderContext,
  CollectionLoaderResult,
} from './types'
import type {
  FileLoaderOptions,
  GlobLoaderFile,
  GlobLoaderOptions,
} from './content-server'

export type { FileLoaderOptions, GlobLoaderFile, GlobLoaderOptions }

/**
 * @deprecated Import `glob` from `@briansunter/nib/server`.
 *
 * This compatibility wrapper stays lazy so the universal root module does not
 * load Node implementation code in browser bundles.
 */
export function glob(options: GlobLoaderOptions) {
  return async (context: CollectionLoaderContext): Promise<CollectionLoaderResult> => {
    const server = await import('./content-server')
    return server.glob(options)(context)
  }
}

/**
 * @deprecated Import `file` from `@briansunter/nib/server`.
 *
 * This compatibility wrapper stays lazy so the universal root module does not
 * load Node implementation code in browser bundles.
 */
export function file(options: FileLoaderOptions) {
  return async (context: CollectionLoaderContext): Promise<CollectionLoaderResult> => {
    const server = await import('./content-server')
    return server.file(options)(context)
  }
}
