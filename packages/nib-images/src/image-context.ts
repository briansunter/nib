import { createContext, createElement, useContext, type ReactNode } from 'react'
import type { ImageBuildRegistry } from './image-registry'

const ImageRegistryContext = createContext<ImageBuildRegistry | null>(null)

export function ImageRegistryProvider(
  { registry, children }: { registry: ImageBuildRegistry; children: ReactNode },
) {
  return createElement(ImageRegistryContext.Provider, { value: registry }, children)
}

export function useImageRegistry(): ImageBuildRegistry {
  const registry = useContext(ImageRegistryContext)
  if (!registry) {
    throw new Error('@briansunter/nib-images: <Image> requires images() in nib.config.ts')
  }
  return registry
}
