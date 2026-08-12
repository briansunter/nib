import type { RenderedPage } from './types'

const HEAD_OUTLET = '<!--head-outlet-->'
const SSR_OUTLET = '<!--ssr-outlet-->'
const ISLANDS_SCRIPT = /(?:<!--nib-islands-entry-->\s*)?<script\b(?=[^>]*\bdata-nib-islands(?:\s|=|>))[^>]*>[\s\S]*?<\/script>/gi
const ENHANCEMENTS_SCRIPT = /(?:<!--nib-enhancements-entry-->\s*)?<script\b(?=[^>]*\bdata-nib-enhancements(?:\s|=|>))[^>]*>[\s\S]*?<\/script>/gi
const ISLANDS_PRELOAD = /<link\b(?=[^>]*\bdata-nib-runtime-preload=["']islands["'])[^>]*>/gi
const ENHANCEMENTS_PRELOAD = /<link\b(?=[^>]*\bdata-nib-runtime-preload=["']enhancements["'])[^>]*>/gi
const MODULE_PRELOAD = /<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*>/gi
const LINK_HREF = /\bhref=["']([^"']+)["']/i

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

/**
 * Runtime entries can share a Rollup chunk. Strip inactive owners before
 * deduplication so a single-owner route keeps its dependency, then retain the
 * first active preload for each href.
 */
function dedupeModulePreloads(document: string): string {
  const seen = new Set<string>()
  return document.replace(MODULE_PRELOAD, (link) => {
    const href = link.match(LINK_HREF)?.[1]
    if (href === undefined || !seen.has(href)) {
      if (href !== undefined) seen.add(href)
      return link
    }
    return ''
  })
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
  const enhancementScripts = [...document.matchAll(ENHANCEMENTS_SCRIPT)]

  if (islandScripts.length > 1) {
    throw new Error('HTML template contains multiple island entry blocks')
  }
  if (enhancementScripts.length > 1) {
    throw new Error('HTML template contains multiple enhancement entry blocks')
  }
  if (islandScripts.length === 0 && page.islands.length > 0) {
    throw new Error('HTML template is missing the island entry block')
  }
  if (enhancementScripts.length === 0 && page.enhancements.length > 0) {
    throw new Error('HTML template is missing the enhancement entry block')
  }
  if (page.islands.length === 0) {
    document = document.replace(ISLANDS_SCRIPT, '').replace(ISLANDS_PRELOAD, '')
  }
  if (page.enhancements.length === 0) {
    document = document.replace(ENHANCEMENTS_SCRIPT, '').replace(ENHANCEMENTS_PRELOAD, '')
  }
  return dedupeModulePreloads(document)
}
