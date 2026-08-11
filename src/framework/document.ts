import type { RenderedPage } from './types'

const HEAD_OUTLET = '<!--head-outlet-->'
const SSR_OUTLET = '<!--ssr-outlet-->'
const BEHAVIORS_SCRIPT = /(?:<!--nib-behaviors-entry-->\s*)?<script\b(?=[^>]*\bdata-nib-behaviors(?:\s|=|>))[^>]*>[\s\S]*?<\/script>/gi
const BEHAVIORS_PRELOAD = /<link\b(?=[^>]*\bdata-nib-runtime-preload=["']behaviors["'])[^>]*>/gi

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
  const behaviorScripts = [...document.matchAll(BEHAVIORS_SCRIPT)]

  if (behaviorScripts.length > 1) {
    throw new Error('HTML template contains multiple behavior entry blocks')
  }
  if (behaviorScripts.length === 0 && page.behaviors.length > 0) {
    throw new Error('HTML template is missing the behavior entry block')
  }
  return page.behaviors.length > 0
    ? document
    : document.replace(BEHAVIORS_SCRIPT, '').replace(BEHAVIORS_PRELOAD, '')
}
