import type { ComponentType } from 'react'
import type {
  DataPageProps,
  NibConfig,
  PageLayoutProps,
  PageProps,
} from './types'

/**
 * Marks an ordinary page as a Nib page and checks its props at the authoring
 * seam. The function is intentionally identity-only; it adds no runtime code.
 */
export function definePage<Config extends NibConfig = NibConfig>(
  component: ComponentType<PageProps<Config>>,
): ComponentType<PageProps<Config>> {
  return component
}

/** The data-page counterpart to definePage for pages backed by a collection. */
export function defineDataPage<
  Data = unknown,
  Config extends NibConfig = NibConfig,
>(
  component: ComponentType<DataPageProps<Data, Config>>,
): ComponentType<DataPageProps<Data, Config>> {
  return component
}

/**
 * Marks a folder or named layout and checks its frontmatter, data, collections,
 * and children props. Like definePage, this is erased at runtime.
 */
export function defineLayout<
  Frontmatter = unknown,
  Config extends NibConfig = NibConfig,
  Data = Frontmatter,
>(
  component: ComponentType<PageLayoutProps<Frontmatter, Config, Data>>,
): ComponentType<PageLayoutProps<Frontmatter, Config, Data>> {
  return component
}
