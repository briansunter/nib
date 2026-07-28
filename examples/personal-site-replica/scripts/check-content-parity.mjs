import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDist = process.env.PERSONAL_SITE_DIST
  ? path.resolve(process.cwd(), process.env.PERSONAL_SITE_DIST)
  : path.resolve(packageRoot, '../../../personal-site/dist')
const clientDist = process.env.NIB_CLIENT_DIST
  ? path.resolve(process.cwd(), process.env.NIB_CLIENT_DIST)
  : path.join(packageRoot, 'dist/client')
const publicationFile = path.join(clientDist, '.nib/publication.json')
const contentDirectory = path.join(packageRoot, 'src/content')
const pagesDirectory = path.join(packageRoot, 'src/pages')
const siteOrigin = 'https://briansunter.com'
const maxReportedDifferences = Number.parseInt(
  process.env.CONTENT_PARITY_MAX_DIFFS ?? '80',
  10,
)
const requestedRoute = process.env.CONTENT_PARITY_ROUTE
const requestedTemplate = process.env.CONTENT_PARITY_TEMPLATE

const voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])
const rawElements = new Set(['script', 'style', 'svg', 'template', 'noscript'])
const blockElements = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'br',
  'dd',
  'details',
  'dialog',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
])
const ignoredTextElements = new Set([
  'script',
  'style',
  'svg',
  'template',
  'noscript',
])
const structuralTags = ['figure', 'figcaption', 'code', 'pre', 'iframe', 'table']

const namedEntities = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['gt', '>'],
  ['lt', '<'],
  ['mdash', '—'],
  ['nbsp', '\u00a0'],
  ['quot', '"'],
])

function decodeHtml(value = '') {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_match, code) => (
      String.fromCodePoint(Number.parseInt(code, 16))
    ))
    .replace(/&#(\d+);?/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => (
      namedEntities.get(name.toLowerCase()) ?? match
    ))
}

function normalizeText(value = '') {
  return decodeHtml(value)
    .normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?%°)\]}])/g, '$1')
    .replace(/([(\[{])\s+/g, '$1')
    .trim()
}

function normalizeTypographyText(value = '') {
  return decodeHtml(value)
    .normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?%°)\]}])/g, '$1')
    .replace(/([(\[{])\s+/g, '$1')
    .trim()
}

function findTagEnd(html, start) {
  let quote = ''
  for (let index = start + 1; index < html.length; index += 1) {
    const character = html[index]
    if (quote) {
      if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === '>') return index
  }
  return html.length - 1
}

function parseAttributes(source) {
  const attributes = new Map()
  let index = 0

  while (index < source.length) {
    while (/\s/.test(source[index] ?? '')) index += 1
    if (index >= source.length || source[index] === '/') break

    const nameStart = index
    while (index < source.length && !/[\s=/>]/.test(source[index])) index += 1
    const name = source.slice(nameStart, index).toLowerCase()
    if (!name) {
      index += 1
      continue
    }

    while (/\s/.test(source[index] ?? '')) index += 1
    let value = ''
    if (source[index] === '=') {
      index += 1
      while (/\s/.test(source[index] ?? '')) index += 1
      const quote = source[index]
      if (quote === '"' || quote === "'") {
        index += 1
        const valueStart = index
        while (index < source.length && source[index] !== quote) index += 1
        value = source.slice(valueStart, index)
        if (source[index] === quote) index += 1
      } else {
        const valueStart = index
        while (index < source.length && !/[\s>]/.test(source[index])) index += 1
        value = source.slice(valueStart, index)
      }
    }
    attributes.set(name, decodeHtml(value))
  }

  return attributes
}

function parseHtml(html) {
  const root = { type: 'element', tag: '#document', attributes: new Map(), children: [] }
  const stack = [root]
  const lowerHtml = html.toLowerCase()
  let index = 0

  while (index < html.length) {
    if (html[index] !== '<') {
      const nextTag = html.indexOf('<', index)
      const end = nextTag === -1 ? html.length : nextTag
      stack.at(-1).children.push({ type: 'text', value: html.slice(index, end) })
      index = end
      continue
    }

    if (html.startsWith('<!--', index)) {
      const end = html.indexOf('-->', index + 4)
      index = end === -1 ? html.length : end + 3
      continue
    }

    if (html.startsWith('<!', index) || html.startsWith('<?', index)) {
      index = findTagEnd(html, index) + 1
      continue
    }

    const tagEnd = findTagEnd(html, index)
    const token = html.slice(index + 1, tagEnd)
    const closing = /^\s*\//.test(token)
    const selfClosing = /\/\s*$/.test(token)
    const nameMatch = token.match(closing
      ? /^\s*\/\s*([^\s/>]+)/
      : /^\s*([^\s/>]+)/)
    const tag = nameMatch?.[1]?.toLowerCase()
    if (!tag) {
      index = tagEnd + 1
      continue
    }

    if (closing) {
      for (let stackIndex = stack.length - 1; stackIndex > 0; stackIndex -= 1) {
        if (stack[stackIndex].tag !== tag) continue
        stack.length = stackIndex
        break
      }
      index = tagEnd + 1
      continue
    }

    const nameEnd = token.indexOf(nameMatch[1]) + nameMatch[1].length
    const node = {
      type: 'element',
      tag,
      attributes: parseAttributes(token.slice(nameEnd)),
      children: [],
    }
    stack.at(-1).children.push(node)
    index = tagEnd + 1

    if (voidElements.has(tag) || selfClosing) continue

    if (rawElements.has(tag)) {
      const closeStart = lowerHtml.indexOf(`</${tag}`, index)
      if (closeStart === -1) {
        index = html.length
        continue
      }
      const closeEnd = findTagEnd(html, closeStart)
      index = closeEnd + 1
      continue
    }

    stack.push(node)
  }

  return root
}

function hasAttribute(node, name) {
  return node.type === 'element' && node.attributes.has(name)
}

function attribute(node, name) {
  return node.type === 'element' ? (node.attributes.get(name) ?? '') : ''
}

function hasClass(node, className) {
  return attribute(node, 'class').split(/\s+/).includes(className)
}

function isIgnored(node, pagefindAware = false) {
  if (node.type !== 'element') return false
  if (ignoredTextElements.has(node.tag)) return true
  if (hasAttribute(node, 'hidden')) return true
  if (attribute(node, 'aria-hidden').toLowerCase() === 'true') return true
  if (/display\s*:\s*none/i.test(attribute(node, 'style'))) return true
  return pagefindAware && hasAttribute(node, 'data-pagefind-ignore')
}

function walk(node, visit, options = {}, ignoredAncestor = false) {
  const ignored = ignoredAncestor || isIgnored(node, options.pagefindAware)
  if (ignored) return
  if (node.type === 'element') visit(node)
  for (const child of node.children ?? []) walk(child, visit, options, ignored)
}

function elements(node, predicate, options = {}) {
  const matches = []
  walk(node, (candidate) => {
    if (predicate(candidate)) matches.push(candidate)
  }, options)
  return matches
}

function firstElement(node, predicate, options = {}) {
  return elements(node, predicate, options)[0]
}

function textContent(node, options = {}, normalize = normalizeText) {
  const parts = []

  function separatesChildren(candidate) {
    if (candidate.type !== 'element') return false
    const classes = attribute(candidate, 'class').split(/\s+/)
    return classes.some((className) => (
      ['flex', 'inline-flex', 'grid', 'inline-grid', 'contents', 'segmented-control'].includes(className)
      || /^(?:gap|gap-[xy]|space-[xy])-/.test(className)
    ))
  }

  function createsBoundary(candidate) {
    if (candidate.type !== 'element') return false
    if (blockElements.has(candidate.tag)) return true
    const classes = attribute(candidate, 'class').split(/\s+/)
    return classes.some((className) => (
      ['block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'list-item', 'table'].includes(className)
    ))
  }

  function hasVisibleText(candidate, ignoredAncestor = false) {
    if (candidate.type === 'text') return !ignoredAncestor && /\S/.test(candidate.value)
    const ignored = ignoredAncestor || isIgnored(candidate, options.pagefindAware)
    if (ignored) return false
    return candidate.children.some((child) => hasVisibleText(child, ignored))
  }

  function collect(candidate, ignoredAncestor = false) {
    if (candidate.type === 'text') {
      if (!ignoredAncestor) parts.push(candidate.value)
      return
    }

    const ignored = ignoredAncestor || isIgnored(candidate, options.pagefindAware)
    if (ignored) return
    const block = createsBoundary(candidate)
    const separated = separatesChildren(candidate)
    if (block) parts.push(' ')
    candidate.children.forEach((child, index) => {
      if (separated && index > 0) parts.push(' ')
      if (
        child.type === 'element'
        && isIgnored(child, options.pagefindAware)
        && candidate.children.slice(0, index).some((sibling) => hasVisibleText(sibling))
        && candidate.children.slice(index + 1).some((sibling) => hasVisibleText(sibling))
      ) {
        // Preserve the semantic boundary supplied by a decorative middot or
        // icon only when it actually separates visible values.
        parts.push(' ')
      }
      collect(child, ignored)
    })
    if (block) parts.push(' ')
  }

  collect(node)
  return normalize(parts.join(''))
}

function semanticRoots(document, predicate) {
  return elements(document, predicate)
}

function virtualRoot(roots) {
  return {
    type: 'element',
    tag: '#selection',
    attributes: new Map(),
    children: roots,
  }
}

function headingFacts(root, options = {}) {
  return elements(root, (node) => /^h[1-6]$/.test(node.tag), options).map((node) => ({
    level: Number(node.tag.slice(1)),
    id: attribute(node, 'id'),
    text: textContent(node, options),
  }))
}

function dateFacts(root, options = {}) {
  return elements(root, (node) => node.tag === 'time', options).map((node) => ({
    datetime: attribute(node, 'datetime'),
    text: textContent(node, options),
  }))
}

function normalizeHref(value) {
  const href = decodeHtml(value).trim()
  if (!href) return ''

  let normalized = href
  try {
    const url = new URL(href, siteOrigin)
    if (url.origin === siteOrigin) normalized = `${url.pathname}${url.search}${url.hash}`
  } catch {
    normalized = href
  }

  const assetMatch = normalized.match(
    /^\/(?:_astro|site-assets)(?:\/[^?#]*)?\/([^/?#]+?)(?:\.[A-Za-z0-9_-]{7,})?\.([A-Za-z0-9]+)(?:[?#].*)?$/,
  )
  if (assetMatch) return `asset:${assetMatch[1]}.${assetMatch[2]}`.toLowerCase()
  if (normalized.length > 1 && normalized.endsWith('/')) return normalized.slice(0, -1)
  return normalized
}

function hrefFacts(root, options = {}) {
  return elements(root, (node) => node.tag === 'a' && hasAttribute(node, 'href'), options)
    .map((node) => ({
      href: normalizeHref(attribute(node, 'href')),
      text: textContent(node, options),
    }))
}

function structuralCounts(root, options = {}) {
  return Object.fromEntries(structuralTags.map((tag) => [
    tag,
    elements(root, (node) => node.tag === tag, options).length,
  ]))
}

function editorialDirectChildTags(root, options = {}) {
  return elements(root, (node) => hasClass(node, 'prose-editorial'), options)
    .map((editorialRoot) => editorialRoot.children
      .filter((child) => child.type === 'element' && !isIgnored(child, options.pagefindAware))
      .map((child) => child.tag))
}

function keyCollectionCounts(root, template) {
  const countClass = (className) => elements(root, (node) => hasClass(node, className)).length
  const countTag = (tag) => elements(root, (node) => node.tag === tag).length

  switch (template) {
    case 'home':
      return {
        featuredPosts: countClass('featured-post'),
        writingItems: countClass('post-item'),
      }
    case 'archive':
    case 'tag-detail':
      return { writingItems: countClass('post-item') }
    case 'project-index':
      return { projectCards: countClass('project-card') }
    case 'recipe-index':
      return { recipeItems: countClass('recipe-list-item') }
    case 'tag-index':
      return { tagItems: countClass('tag-item') }
    case 'search':
      return {
        topicLinks: countClass('topic-link'),
        recentWritingItems: countClass('recent-writing-item'),
      }
    case 'photo-gallery':
      return {
        galleryGroups: countClass('photo-items'),
        photoItems: countClass('photo-item'),
      }
    case 'art-gallery':
      return {
        galleryGroups: countClass('art-items'),
        artItems: countClass('art-item'),
      }
    case 'pin-collection':
      return { pinCards: countClass('pin-card') }
    case 'travel-map':
      return {
        regions: countClass('travel-region-group'),
        countries: countClass('travel-country-row'),
        statesAndProvinces: countClass('travel-state-row'),
        cities: countClass('travel-city-line'),
      }
    case 'explore':
      return { destinations: countTag('li') }
    default:
      return {}
  }
}

function routeTemplate(route, indexedTemplate) {
  if (indexedTemplate) return indexedTemplate
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

async function indexedRouteMap() {
  const [pageFiles, projects, recipes] = await Promise.all([
    filesUnder(pagesDirectory),
    readFile(path.join(contentDirectory, 'projects.json'), 'utf8').then(JSON.parse),
    readFile(path.join(contentDirectory, 'recipes.json'), 'utf8').then(JSON.parse),
  ])
  const writingRoutes = []
  for (const file of pageFiles.sort()) {
    if (path.basename(file) !== 'page.md') continue
    const source = await readFile(file, 'utf8')
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)?.[1] ?? ''
    if (!/^layout:\s*["']?article["']?\s*$/m.test(frontmatter)) continue
    const slug = path.relative(pagesDirectory, path.dirname(file)).split(path.sep).join('/')
    writingRoutes.push(`/${slug}`)
  }
  const entries = [
    ...writingRoutes.map((route) => [route, 'writing']),
    ...projects.map((item) => [`/projects/${item.slug}`, 'project']),
    ...recipes.map((item) => [`/recipes/${item.slug}`, 'recipe']),
  ]
  const routes = new Map(entries)
  if (routes.size !== entries.length) {
    throw new Error(`Indexed content contains ${entries.length - routes.size} duplicate route(s)`)
  }
  return routes
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function firstTextDifference(source, target) {
  let index = 0
  while (index < source.length && index < target.length && source[index] === target[index]) index += 1
  const start = Math.max(0, index - 70)
  const end = index + 90
  return {
    index,
    sourceLength: source.length,
    targetLength: target.length,
    sourceContext: source.slice(start, end),
    targetContext: target.slice(start, end),
  }
}

function firstArrayDifference(source, target) {
  const length = Math.max(source.length, target.length)
  for (let index = 0; index < length; index += 1) {
    if (sameValue(source[index], target[index])) continue
    return {
      index,
      sourceLength: source.length,
      targetLength: target.length,
      source: source[index],
      target: target[index],
    }
  }
  return undefined
}

function addDifference(differences, route, template, field, source, target) {
  if (sameValue(source, target)) return
  let detail
  if (typeof source === 'string' && typeof target === 'string') {
    detail = firstTextDifference(source, target)
  } else if (Array.isArray(source) && Array.isArray(target)) {
    detail = firstArrayDifference(source, target)
  } else {
    detail = { source, target }
  }
  differences.push({ route, template, field, ...detail })
}

function formatDifference(difference) {
  const label = `${difference.route} [${difference.template}] ${difference.field}`
  if ('sourceContext' in difference) {
    return `${label} at character ${difference.index} (${difference.sourceLength} vs ${difference.targetLength})\n`
      + `    source: ${JSON.stringify(difference.sourceContext)}\n`
      + `    target: ${JSON.stringify(difference.targetContext)}`
  }
  if ('index' in difference) {
    return `${label} at item ${difference.index} (${difference.sourceLength} vs ${difference.targetLength})\n`
      + `    source: ${JSON.stringify(difference.source)}\n`
      + `    target: ${JSON.stringify(difference.target)}`
  }
  return `${label}\n`
    + `    source: ${JSON.stringify(difference.source)}\n`
    + `    target: ${JSON.stringify(difference.target)}`
}

function ensureTemplateSummary(summaries, template) {
  if (!summaries[template]) {
    summaries[template] = {
      routes: 0,
      comparedFields: 0,
      sourceStructures: Object.fromEntries(structuralTags.map((tag) => [tag, 0])),
      targetStructures: Object.fromEntries(structuralTags.map((tag) => [tag, 0])),
    }
  }
  return summaries[template]
}

function addCounts(total, counts) {
  for (const [key, value] of Object.entries(counts)) total[key] = (total[key] ?? 0) + value
}

const [publication, indexedRoutes, sourceMarkdownFiles] = await Promise.all([
  readFile(publicationFile, 'utf8').then(JSON.parse),
  indexedRouteMap(),
  filesUnder(sourceDist).then((files) => files.filter((file) => file.endsWith('.md'))),
])

const targetPages = publication.routes.filter((route) => route.kind === 'page')
const targetPageMap = new Map(targetPages.map((route) => [route.path, route]))
const sourceRoutes = sourceMarkdownFiles.map(routeFromMarkdown).sort()
const sourceRouteSet = new Set(sourceRoutes)
const targetRouteSet = new Set(targetPages.map((route) => route.path))
const routesToCompare = requestedRoute
  ? sourceRoutes.filter((route) => route === requestedRoute)
  : requestedTemplate
    ? sourceRoutes.filter((route) => routeTemplate(route, indexedRoutes.get(route)) === requestedTemplate)
    : sourceRoutes
const differences = []
const templateTotals = {}

if ((requestedRoute || requestedTemplate) && routesToCompare.length === 0) {
  throw new Error(
    requestedRoute
      ? `CONTENT_PARITY_ROUTE does not match a canonical source route: ${requestedRoute}`
      : `CONTENT_PARITY_TEMPLATE does not match a source template: ${requestedTemplate}`,
  )
}

for (const route of routesToCompare) {
  if (!targetRouteSet.has(route)) {
    differences.push({
      route,
      template: routeTemplate(route, indexedRoutes.get(route)),
      field: 'route',
      source: 'present',
      target: 'missing',
    })
  }
}
for (const route of requestedRoute || requestedTemplate ? [] : [...targetRouteSet].sort()) {
  if (!sourceRouteSet.has(route)) {
    differences.push({
      route,
      template: routeTemplate(route, indexedRoutes.get(route)),
      field: 'route',
      source: 'missing',
      target: 'present',
    })
  }
}

for (const route of routesToCompare) {
  const targetRoute = targetPageMap.get(route)
  if (!targetRoute) continue

  const indexedTemplate = indexedRoutes.get(route)
  const template = routeTemplate(route, indexedTemplate)
  const summary = ensureTemplateSummary(templateTotals, template)
  summary.routes += 1

  const [sourceHtml, targetHtml] = await Promise.all([
    readFile(sourceHtmlFile(route), 'utf8'),
    readFile(path.join(clientDist, targetRoute.artifact), 'utf8'),
  ])
  const sourceDocument = parseHtml(sourceHtml)
  const targetDocument = parseHtml(targetHtml)
  // Astro's gallery shell uses a div#main-content around a nested <main>,
  // while Nib's document wrapper makes #main-content the <main> itself.
  // Compare the shared semantic boundary, not either framework's tag choice.
  const sourceMain = firstElement(sourceDocument, (node) => attribute(node, 'id') === 'main-content')
    ?? firstElement(sourceDocument, (node) => node.tag === 'main')
  const targetMain = firstElement(targetDocument, (node) => attribute(node, 'id') === 'main-content')
    ?? firstElement(targetDocument, (node) => node.tag === 'main')

  if (!sourceMain || !targetMain) {
    addDifference(
      differences,
      route,
      template,
      'main',
      sourceMain ? 'present' : 'missing',
      targetMain ? 'present' : 'missing',
    )
    continue
  }

  if (indexedTemplate) {
    const sourceBodies = semanticRoots(sourceDocument, (node) => (
      hasAttribute(node, 'data-pagefind-body')
    ))
    const targetBodies = semanticRoots(targetDocument, (node) => (
      hasAttribute(node, 'data-pagefind-body')
    ))
    addDifference(
      differences,
      route,
      template,
      'pagefindBodyCount',
      sourceBodies.length,
      targetBodies.length,
    )
    if (sourceBodies.length !== 1 || targetBodies.length !== 1) continue

    const sourceBody = virtualRoot(sourceBodies)
    const targetBody = virtualRoot(targetBodies)
    const sourceStructure = structuralCounts(sourceBody, { pagefindAware: true })
    const targetStructure = structuralCounts(targetBody, { pagefindAware: true })
    addCounts(summary.sourceStructures, sourceStructure)
    addCounts(summary.targetStructures, targetStructure)

    const comparisons = [
      ['pagefindBodyText', textContent(sourceBody, { pagefindAware: true }), textContent(targetBody, { pagefindAware: true })],
      ...(indexedTemplate === 'project'
        ? [[
            'projectTypography',
            textContent(sourceBody, { pagefindAware: true }, normalizeTypographyText),
            textContent(targetBody, { pagefindAware: true }, normalizeTypographyText),
          ]]
        : []),
      ...(['writing', 'project'].includes(indexedTemplate)
        ? [[
            'editorialDirectChildTags',
            editorialDirectChildTags(sourceBody, { pagefindAware: true }),
            editorialDirectChildTags(targetBody, { pagefindAware: true }),
          ]]
        : []),
      ['headings', headingFacts(sourceBody, { pagefindAware: true }), headingFacts(targetBody, { pagefindAware: true })],
      ['dates', dateFacts(sourceMain, { pagefindAware: true }), dateFacts(targetMain, { pagefindAware: true })],
      ['hrefs', hrefFacts(sourceBody, { pagefindAware: true }), hrefFacts(targetBody, { pagefindAware: true })],
      ['structures', sourceStructure, targetStructure],
    ]
    for (const [field, source, target] of comparisons) {
      summary.comparedFields += 1
      addDifference(differences, route, template, field, source, target)
    }
    continue
  }

  const sourceKeyCounts = keyCollectionCounts(sourceMain, template)
  const targetKeyCounts = keyCollectionCounts(targetMain, template)
  summary.sourceKeyCollections ??= {}
  summary.targetKeyCollections ??= {}
  addCounts(summary.sourceKeyCollections, sourceKeyCounts)
  addCounts(summary.targetKeyCollections, targetKeyCounts)

  const comparisons = [
    ['mainText', textContent(sourceMain), textContent(targetMain)],
    ['h1', headingFacts(sourceMain).filter((heading) => heading.level === 1), headingFacts(targetMain).filter((heading) => heading.level === 1)],
    ['headings', headingFacts(sourceMain), headingFacts(targetMain)],
    ['dates', dateFacts(sourceMain), dateFacts(targetMain)],
    ['hrefs', hrefFacts(sourceMain), hrefFacts(targetMain)],
    ['keyCollections', sourceKeyCounts, targetKeyCounts],
  ]
  for (const [field, source, target] of comparisons) {
    summary.comparedFields += 1
    addDifference(differences, route, template, field, source, target)
  }
}

const indexedTemplateTotals = Object.fromEntries(
  ['writing', 'project', 'recipe'].map((template) => [
    template,
    [...indexedRoutes.values()].filter((value) => value === template).length,
  ]),
)
const summary = {
  sourceDist,
  clientDist,
  scope: requestedRoute ?? (requestedTemplate ? `template:${requestedTemplate}` : 'all canonical routes'),
  canonicalPages: {
    source: sourceRoutes.length,
    target: targetPages.length,
    compared: Object.values(templateTotals).reduce((total, item) => total + item.routes, 0),
  },
  indexedPages: {
    ...indexedTemplateTotals,
    total: indexedRoutes.size,
  },
  remainingPages: sourceRoutes.length - indexedRoutes.size,
  templateTotals,
  differences: differences.length,
  result: differences.length === 0 ? 'exact semantic content parity' : 'content parity failed',
}

console.log(JSON.stringify(summary, null, 2))

if (differences.length > 0) {
  const visible = differences.slice(0, maxReportedDifferences)
  const hidden = differences.length - visible.length
  console.error(
    `\nContent parity failed with ${differences.length} difference(s):\n\n`
    + visible.map((difference) => `- ${formatDifference(difference)}`).join('\n')
    + (hidden > 0 ? `\n\n… ${hidden} more difference(s); set CONTENT_PARITY_MAX_DIFFS to show more.` : ''),
  )
  process.exitCode = 1
}
