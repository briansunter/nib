import type { ImageSource } from './image-source'

/**
 * Resolves a configured content-image URL to its static image metadata.
 *
 * The `images()` Vite plugin replaces this entry with a generated, build-time
 * catalog. Calling the packaged fallback means the plugin is not active in the
 * current server graph.
 */
export function resolveContentImage(_publicPath: string | null | undefined): ImageSource | undefined {
  // The images() plugin replaces this module with a generated catalog during
  // a site build. Keeping the package fallback total makes direct component
  // tests and optional content images render their normal unoptimized path.
  return undefined
}
