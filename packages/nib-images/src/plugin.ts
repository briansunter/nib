import type { NibPlugin } from '@briansunter/nib/plugin'
import { createElement } from 'react'
import { ImageRegistryProvider } from './image-context'
import { ImageBuildRegistry } from './image-registry'
import { imageVitePlugin } from './image-vite-plugin'
import { normalizeImagesOptions, validateImagesOptions, type ImagesOptions } from './options'
import { optimizeContentImages, restoreFailedContentImages } from './content-images'

export type { ContentImageSource, ImagesOptions } from './options'

export function images<const Options extends ImagesOptions>(options?: Options) {
  validateImagesOptions(options)
  return {
    name: '@briansunter/nib-images',
    vite(context) {
      return imageVitePlugin(normalizeImagesOptions(context.root, options), context.target)
    },
    renderer(context) {
      const normalizedOptions = normalizeImagesOptions(context.root, options)
      const registry = new ImageBuildRegistry(
        normalizedOptions,
        context.base,
        context.mode,
      )
      return {
        wrapPage(page) {
          return createElement(ImageRegistryProvider, { registry, children: page })
        },
        async finalize(finalizeContext) {
          await optimizeContentImages(
            finalizeContext.clientDirectory,
            context.base,
            normalizedOptions,
            registry,
          )
          await registry.finalize(finalizeContext.clientDirectory)
          await restoreFailedContentImages(finalizeContext.clientDirectory, registry)
        },
      }
    },
  } satisfies NibPlugin
}
