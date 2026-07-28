import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const sourceDist = path.resolve(
  process.env.PERSONAL_SITE_DIST ?? path.join(root, '../../../personal-site/dist'),
)
const client = path.join(root, 'dist/client')
const publicationFile = path.join(client, '.nib/publication.json')

async function filesUnder(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(file))
    else files.push(file)
  }
  return files
}

function routeFromMarkdown(file) {
  const relative = path.relative(sourceDist, file).split(path.sep).join('/')
  const withoutExtension = relative.replace(/\.md$/, '')
  if (withoutExtension === 'index') return '/'
  return `/${withoutExtension.replace(/\/index$/, '')}`
}

function sourceHtmlFile(route) {
  return route === '/'
    ? path.join(sourceDist, 'index.html')
    : path.join(sourceDist, `${route.slice(1)}.html`)
}

function decodeHtml(value = '') {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replaceAll('&nbsp;', '\u00a0')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function textContent(value = '') {
  return decodeHtml(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizedText(value) {
  return textContent(value)
    .normalize('NFKC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)=(?:"([^"]*)"|'([^']*)')/g)]
      .map((match) => [match[1].toLowerCase(), decodeHtml(match[2] ?? match[3] ?? '')]),
  )
}

function extractDocumentFacts(html) {
  const meta = new Map()
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const values = attributes(tag)
    const key = values.property ?? values.name
    if (!key) continue
    const existing = meta.get(key) ?? []
    existing.push(values.content ?? '')
    meta.set(key, existing)
  }

  let canonical = ''
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const values = attributes(tag)
    if (values.rel === 'canonical') canonical = values.href ?? ''
  }

  return {
    title: textContent(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]),
    description: meta.get('description')?.[0] ?? '',
    h1: textContent(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]),
    canonical,
    meta,
  }
}

const parityMetaKeys = [
  'robots',
  'keywords',
  'og:title',
  'og:description',
  'og:type',
  'og:url',
  'og:site_name',
  'og:locale',
  'og:image',
  'og:image:alt',
  'og:image:type',
  'og:image:width',
  'og:image:height',
  'twitter:card',
  'twitter:site',
  'twitter:title',
  'twitter:description',
  'twitter:image',
  'twitter:image:alt',
  'article:author',
  'article:published_time',
  'article:modified_time',
  'article:section',
  'article:tag',
]

function sameValues(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function formatDifference(difference) {
  if (difference.kind === 'route') {
    return `${difference.side} route ${difference.route}`
  }
  return `${difference.route} ${difference.field}: source=${JSON.stringify(difference.source)} target=${JSON.stringify(difference.target)}`
}

const publication = JSON.parse(await readFile(publicationFile, 'utf8'))
const targetPages = publication.routes.filter((route) => route.kind === 'page')
const targetPageMap = new Map(targetPages.map((route) => [route.path, route]))
const sourceMarkdownFiles = (await filesUnder(sourceDist)).filter((file) => file.endsWith('.md'))
const sourceRoutes = sourceMarkdownFiles.map(routeFromMarkdown).sort()
const sourceRouteSet = new Set(sourceRoutes)
const targetRoutes = targetPages.map((route) => route.path).sort()
const targetRouteSet = new Set(targetRoutes)
const differences = []

for (const route of sourceRoutes) {
  if (!targetRouteSet.has(route)) differences.push({ kind: 'route', side: 'missing target', route })
}
for (const route of targetRoutes) {
  if (!sourceRouteSet.has(route)) differences.push({ kind: 'route', side: 'extra target', route })
}

for (const route of sourceRoutes) {
  const targetRoute = targetPageMap.get(route)
  if (!targetRoute) continue
  const sourceHtml = await readFile(sourceHtmlFile(route), 'utf8')
  const targetHtml = await readFile(path.join(client, targetRoute.artifact), 'utf8')
  const source = extractDocumentFacts(sourceHtml)
  const target = extractDocumentFacts(targetHtml)

  for (const field of ['title', 'description', 'h1']) {
    if (normalizedText(source[field]) !== normalizedText(target[field])) {
      differences.push({
        kind: 'document',
        route,
        field,
        source: source[field],
        target: target[field],
      })
    }
  }

  if (source.canonical !== target.canonical) {
    differences.push({
      kind: 'document',
      route,
      field: 'canonical',
      source: source.canonical,
      target: target.canonical,
    })
  }

  for (const field of parityMetaKeys) {
    const sourceValues = source.meta.get(field) ?? []
    const targetValues = target.meta.get(field) ?? []
    if (!sameValues(sourceValues, targetValues)) {
      differences.push({
        kind: 'document',
        route,
        field,
        source: sourceValues,
        target: targetValues,
      })
    }
  }
}

const sourceRedirectFile = path.join(sourceDist, '_redirects.json')
const sourceRedirects = JSON.parse(await readFile(sourceRedirectFile, 'utf8')).redirects
const targetRedirects = publication.routes.filter((route) => route.kind === 'redirect')
const targetRedirectMap = new Map(targetRedirects.map((route) => [route.path, route]))
for (const redirect of sourceRedirects) {
  const target = targetRedirectMap.get(redirect.source)
  if (!target) {
    differences.push({ kind: 'route', side: 'missing target redirect', route: redirect.source })
    continue
  }
  if (target.destination !== redirect.destination || target.status !== redirect.status) {
    differences.push({
      kind: 'document',
      route: redirect.source,
      field: 'redirect',
      source: { destination: redirect.destination, status: redirect.status },
      target: { destination: target.destination, status: target.status },
    })
  }
}

const allowedTargetRedirects = new Set(['/sitemap-index.xml'])
for (const redirect of targetRedirects) {
  if (
    !allowedTargetRedirects.has(redirect.path)
    && !sourceRedirects.some((source) => source.source === redirect.path)
  ) {
    differences.push({ kind: 'route', side: 'extra target redirect', route: redirect.path })
  }
}

if (differences.length > 0) {
  const preview = differences.slice(0, 80).map(formatDifference).join('\n- ')
  const hidden = differences.length > 80 ? `\n… ${differences.length - 80} more` : ''
  throw new Error(
    `Personal-site parity failed with ${differences.length} difference(s):\n- ${preview}${hidden}`,
  )
}

console.log(JSON.stringify({
  canonicalPages: targetPages.length,
  sourceRedirects: sourceRedirects.length,
  targetRedirects: targetRedirects.length,
  comparedMetadataFields: parityMetaKeys.length + 4,
  result: 'exact route, redirect, title, description, h1, canonical, and social metadata parity',
}, null, 2))
