import type { PageMeta, SiteConfig } from './types'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function resolveMeta(meta: PageMeta | undefined, site: SiteConfig) {
  const rawTitle = meta?.title ?? site.title
  const title = meta?.title && site.titleTemplate
    ? site.titleTemplate.replace('%s', meta.title)
    : rawTitle

  return {
    ...meta,
    title,
    description: meta?.description ?? site.description ?? ''
  }
}

export function renderHead(meta: ReturnType<typeof resolveMeta>): string {
  return [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
  ].join('\n    ')
}
