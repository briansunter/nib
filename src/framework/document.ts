import type { RenderedPage } from './types'

const HEAD_OUTLET = '<!--head-outlet-->'
const SSR_OUTLET = '<!--ssr-outlet-->'
const ISLANDS_SCRIPT = /(?:<!--nib-islands-entry-->\s*)?<script\b(?=[^>]*\bdata-nib-islands(?:\s|=|>))[^>]*>[\s\S]*?<\/script>/gi

function replaceSingleOutlet(template: string, outlet: string, value: string): string {
  const occurrences = template.split(outlet).length - 1
  if (occurrences !== 1) {
    throw new Error(`HTML template must contain exactly one ${outlet} outlet`)
  }
  return template.replace(outlet, value)
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function renderRedirectDocument(destination: string): string {
  const escaped = escapeAttribute(destination)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0;url=${escaped}" />
    <link rel="canonical" href="${escaped}" />
    <title>Redirecting</title>
  </head>
  <body>
    <p>Redirecting to <a href="${escaped}">${escaped}</a>.</p>
  </body>
</html>`
}

export function renderDocument(template: string, page: RenderedPage): string {
  let document = replaceSingleOutlet(template, HEAD_OUTLET, page.head)
  document = replaceSingleOutlet(document, SSR_OUTLET, page.html)
  const islandScripts = [...document.matchAll(ISLANDS_SCRIPT)]

  if (islandScripts.length > 1) {
    throw new Error('HTML template contains multiple island entry blocks')
  }
  if (islandScripts.length === 0) {
    if (page.islands.length > 0) throw new Error('HTML template is missing the island entry block')
    return document
  }

  return page.islands.length > 0 ? document : document.replace(ISLANDS_SCRIPT, '')
}
