import type { NibPlugin } from '@briansunter/nib/plugin'
import { createElement } from 'react'
import { ImageRegistryProvider } from './image-context'
import { ImageBuildRegistry } from './image-registry'
import { imageVitePlugin } from './image-vite-plugin'
import { normalizeImagesOptions, validateImagesOptions, type ImagesOptions } from './options'

export type { ImagesOptions } from './options'

export function images<const Options extends ImagesOptions>(options?: Options) {
  validateImagesOptions(options)
  return {
    name: '@briansunter/nib-images',
    vite(context) {
      return imageVitePlugin(normalizeImagesOptions(context.root, options), context.target)
    },
    renderer(context) {
      const registry = new ImageBuildRegistry(
        normalizeImagesOptions(context.root, options),
        context.base,
        context.mode,
      )
      return {
        wrapPage(page) {
          return createElement(ImageRegistryProvider, { registry, children: page })
        },
        async finalize(finalizeContext) {
          await registry.finalize(finalizeContext.clientDirectory)
        },
      }
    },
  } satisfies NibPlugin
}
