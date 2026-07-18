import type { RenderedPage } from './types'

const ISLANDS_SCRIPT = /<script\b(?=[^>]*\bdata-nib-islands(?:\s|=|>))[^>]*><\/script>/i

export function renderDocument(template: string, page: RenderedPage): string {
  const document = template
    .replace('<!--head-outlet-->', page.head)
    .replace('<!--ssr-outlet-->', page.html)

  if (!ISLANDS_SCRIPT.test(document)) {
    if (page.islands.length > 0) throw new Error('HTML template is missing the island entry block')
    return document
  }

  return page.islands.length > 0 ? document : document.replace(ISLANDS_SCRIPT, '')
}
