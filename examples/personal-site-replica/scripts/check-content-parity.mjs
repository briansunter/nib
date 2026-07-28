import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  semanticAttribute,
  semanticDirectChildTags,
  semanticDocument,
  semanticElements,
  semanticHasClass,
  semanticRoots,
  semanticSnapshot,
} from '@briansunter/nib/testing'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDist = path.resolve(process.cwd(), process.env.PERSONAL_SITE_DIST ?? '../../../personal-site/dist')
const clientDist = path.resolve(process.cwd(), process.env.NIB_CLIENT_DIST ?? path.join(root, 'dist/client'))
const contentDir = path.join(root, 'src/content')
const pagesDir = path.join(root, 'src/pages')
const routeFilter = process.env.CONTENT_PARITY_ROUTE
const templateFilter = process.env.CONTENT_PARITY_TEMPLATE
const maxDifferences = Number.parseInt(process.env.CONTENT_PARITY_MAX_DIFFS ?? '80', 10)
const siteOrigin = 'https://briansunter.com'

async function filesUnder(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(file))
    else files.push(file)
  }
  return files
}

function sourceRoute(file) {
  const relative = path.relative(sourceDist, file).split(path.sep).join('/').replace(/\.md$/, '')
  return relative === 'index' ? '/' : `/${relative.replace(/\/index$/, '')}`
}

function sourceHtml(route) {
  return route === '/' ? path.join(sourceDist, 'index.html') : path.join(sourceDist, `${route.slice(1)}.html`)
}

async function indexedRoutes() {
  const [pageFiles, projects, recipes] = await Promise.all([
    filesUnder(pagesDir),
    readFile(path.join(contentDir, 'projects.json'), 'utf8').then(JSON.parse),
    readFile(path.join(contentDir, 'recipes.json'), 'utf8').then(JSON.parse),
  ])
  const writing = []
  for (const file of pageFiles.sort()) {
    if (path.basename(file) !== 'page.md') continue
    const source = await readFile(file, 'utf8')
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)?.[1] ?? ''
    if (!/^layout:\s*["']?article["']?\s*$/m.test(frontmatter)) continue
    writing.push(`/${path.relative(pagesDir, path.dirname(file)).split(path.sep).join('/')}`)
  }
  const entries = [
    ...writing.map((route) => [route, 'writing']),
    ...projects.map((item) => [`/projects/${item.slug}`, 'project']),
    ...recipes.map((item) => [`/recipes/${item.slug}`, 'recipe']),
  ]
  const result = new Map(entries)
  if (result.size !== entries.length) throw new Error('Indexed content contains duplicate routes')
  return result
}

function template(route, indexed) {
  if (indexed) return indexed
  if (route === '/') return 'home'
  if (route === '/404' || route === '/500') return 'error'
  if (route === '/pages') return 'archive'
  if (route === '/projects') return 'project-index'
  if (route === '/recipes') return 'recipe-index'
  if (route === '/tags') return 'tag-index'
  if (route.startsWith('/tags/')) return 'tag-detail'
  if (route === '/photos') return 'photo-gallery'
  if (route === '/art') return 'art-gallery'
  if (route === '/pin-collection') return 'pin-collection'
  if (route === '/travel-map') return 'travel-map'
  if (route === '/search') return 'search'
  if (route === '/explore') return 'explore'
  return 'static'
}

function mainRoots(document) {
  const identified = semanticRoots(document, { id: 'main-content' })
  return identified.length > 0 ? identified : semanticRoots(document, { tagName: 'main' })
}

function href(value) {
  let normalized = value.trim()
  try {
    const url = new URL(normalized, siteOrigin)
    if (url.origin === siteOrigin) normalized = `${url.pathname}${url.search}${url.hash}`
  } catch {}
  const asset = normalized.match(
    /^\/(?:_astro|site-assets)(?:\/[^?#]*)?\/([^/?#]+?)(?:\.[A-Za-z0-9_-]{7,})?\.([A-Za-z0-9]+)(?:[?#].*)?$/,
  )
  if (asset) return `asset:${asset[1]}.${asset[2]}`.toLowerCase()
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
}

const snapshotOptions = { pagefindAware: true, siteOrigin, normalizeHref: href }
const classCounts = {
  home: { featuredPosts: 'featured-post', writingItems: 'post-item' },
  archive: { writingItems: 'post-item' },
  'tag-detail': { writingItems: 'post-item' },
  'project-index': { projectCards: 'project-card' },
  'recipe-index': { recipeItems: 'recipe-list-item' },
  'tag-index': { tagItems: 'tag-item' },
  search: { topicLinks: 'topic-link', recentWritingItems: 'recent-writing-item' },
  'photo-gallery': { galleryGroups: 'photo-items', photoItems: 'photo-item' },
  'art-gallery': { galleryGroups: 'art-items', artItems: 'art-item' },
  'pin-collection': { pinCards: 'pin-card' },
  'travel-map': {
    regions: 'travel-region-group',
    countries: 'travel-country-row',
    statesAndProvinces: 'travel-state-row',
    cities: 'travel-city-line',
  },
}

function collectionCounts(roots, pageTemplate) {
  if (pageTemplate === 'explore') {
    return { destinations: semanticElements(roots, (node) => node.tagName === 'li').length }
  }
  return Object.fromEntries(Object.entries(classCounts[pageTemplate] ?? {}).map(([name, className]) => [
    name,
    semanticElements(roots, (node) => semanticHasClass(node, className)).length,
  ]))
}

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function addDifference(differences, route, pageTemplate, field, source, target) {
  if (equal(source, target)) return
  differences.push({ route, template: pageTemplate, field, source, target })
}

function compare(differences, route, pageTemplate, fields) {
  for (const [field, source, target] of fields) {
    addDifference(differences, route, pageTemplate, field, source, target)
  }
}

const [publication, indexed, markdownFiles] = await Promise.all([
  readFile(path.join(clientDist, '.nib/publication.json'), 'utf8').then(JSON.parse),
  indexedRoutes(),
  filesUnder(sourceDist).then((files) => files.filter((file) => file.endsWith('.md'))),
])
const targetPages = publication.routes.filter((route) => route.kind === 'page')
const targets = new Map(targetPages.map((route) => [route.path, route]))
const sourceRoutes = markdownFiles.map(sourceRoute).sort()
const sourceSet = new Set(sourceRoutes)
const selected = sourceRoutes.filter((route) => (
  (!routeFilter || route === routeFilter)
  && (!templateFilter || template(route, indexed.get(route)) === templateFilter)
))
if ((routeFilter || templateFilter) && selected.length === 0) throw new Error('Requested parity scope matches no source route')

const differences = []
for (const route of selected) {
  if (!targets.has(route)) addDifference(differences, route, template(route, indexed.get(route)), 'route', 'present', 'missing')
}
if (!routeFilter && !templateFilter) {
  for (const route of [...targets.keys()].sort()) {
    if (!sourceSet.has(route)) addDifference(differences, route, template(route, indexed.get(route)), 'route', 'missing', 'present')
  }
}

let compared = 0
for (const route of selected) {
  const target = targets.get(route)
  if (!target) continue
  const pageTemplate = template(route, indexed.get(route))
  const [source, rendered] = await Promise.all([
    readFile(sourceHtml(route), 'utf8').then(semanticDocument),
    readFile(path.join(clientDist, target.artifact), 'utf8').then(semanticDocument),
  ])
  const sourceMain = mainRoots(source)
  const targetMain = mainRoots(rendered)
  if (sourceMain.length !== 1 || targetMain.length !== 1) {
    addDifference(differences, route, pageTemplate, 'mainCount', sourceMain.length, targetMain.length)
    continue
  }
  const sourceMainFacts = semanticSnapshot(sourceMain, snapshotOptions)
  const targetMainFacts = semanticSnapshot(targetMain, snapshotOptions)
  if (indexed.has(route)) {
    const sourceBody = semanticRoots(source, { attribute: 'data-pagefind-body' })
    const targetBody = semanticRoots(rendered, { attribute: 'data-pagefind-body' })
    addDifference(differences, route, pageTemplate, 'pagefindBodyCount', sourceBody.length, targetBody.length)
    if (sourceBody.length !== 1 || targetBody.length !== 1) continue
    const sourceFacts = semanticSnapshot(sourceBody, snapshotOptions)
    const targetFacts = semanticSnapshot(targetBody, snapshotOptions)
    compare(differences, route, pageTemplate, [
      ['pagefindBodyText', sourceFacts.text, targetFacts.text],
      ...(pageTemplate === 'project' ? [[
        'projectTypography',
        semanticSnapshot(sourceBody, { ...snapshotOptions, normalizer: 'nib-typography-v1' }).text,
        semanticSnapshot(targetBody, { ...snapshotOptions, normalizer: 'nib-typography-v1' }).text,
      ]] : []),
      ...(['writing', 'project'].includes(pageTemplate) ? [[
        'editorialDirectChildTags',
        semanticDirectChildTags(sourceBody, { className: 'prose-editorial' }, snapshotOptions),
        semanticDirectChildTags(targetBody, { className: 'prose-editorial' }, snapshotOptions),
      ]] : []),
      ['headings', sourceFacts.headings, targetFacts.headings],
      ['dates', sourceMainFacts.dates, targetMainFacts.dates],
      ['hrefs', sourceFacts.links, targetFacts.links],
      ['structures', sourceFacts.structures, targetFacts.structures],
    ])
  } else {
    compare(differences, route, pageTemplate, [
      ['mainText', sourceMainFacts.text, targetMainFacts.text],
      ['h1', sourceMainFacts.headings.filter((item) => item.level === 1), targetMainFacts.headings.filter((item) => item.level === 1)],
      ['headings', sourceMainFacts.headings, targetMainFacts.headings],
      ['dates', sourceMainFacts.dates, targetMainFacts.dates],
      ['hrefs', sourceMainFacts.links, targetMainFacts.links],
      ['keyCollections', collectionCounts(sourceMain, pageTemplate), collectionCounts(targetMain, pageTemplate)],
    ])
  }
  compared += 1
}

const summary = {
  scope: routeFilter ?? (templateFilter ? `template:${templateFilter}` : 'all canonical routes'),
  canonicalPages: { source: sourceRoutes.length, target: targetPages.length, compared },
  indexedPages: Object.fromEntries(['writing', 'project', 'recipe'].map((kind) => [
    kind,
    [...indexed.values()].filter((value) => value === kind).length,
  ])),
  differences: differences.length,
  result: differences.length === 0 ? 'exact semantic content parity' : 'content parity failed',
}
console.log(JSON.stringify(summary, null, 2))
if (differences.length > 0) {
  console.error(`\nContent parity failed with ${differences.length} difference(s):\n\n${
    differences.slice(0, maxDifferences).map((difference) => `- ${JSON.stringify(difference)}`).join('\n')
  }`)
  process.exitCode = 1
}
