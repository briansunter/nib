import type { PageModule } from './types'

const pages = import.meta.glob<PageModule>(
  ['../pages/**/page.tsx', '../pages/**/page.md'],
  { eager: true },
)

export function discoverPages(): Record<string, PageModule> {
  return pages
}
