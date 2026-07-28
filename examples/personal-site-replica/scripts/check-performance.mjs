import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const client = path.join(root, 'dist/client')

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(file))
    else files.push(file)
  }
  return files
}

const allFiles = await filesUnder(client)
const htmlFiles = allFiles.filter((file) => file.endsWith('.html'))
const extensionlessPageFiles = allFiles.filter((file) => (
  !file.includes(`${path.sep}assets${path.sep}`)
  && !file.includes(`${path.sep}site-assets${path.sep}`)
  && !file.includes(`${path.sep}videos${path.sep}`)
  && !file.includes(`${path.sep}fonts${path.sep}`)
  && !file.includes(`${path.sep}.well-known${path.sep}`)
  && !['_headers', '_redirects'].includes(path.basename(file))
  && path.extname(file) === ''
))
const pageFiles = [...new Set([...htmlFiles, ...extensionlessPageFiles])]
const fileSet = new Set(allFiles)
const index = await readFile(path.join(client, 'index.html'), 'utf8')
const rss = await readFile(path.join(client, 'index.xml'), 'utf8')
const searchIndexRaw = await readFile(path.join(client, 'pagefind/pagefind-entry.json'), 'utf8')
let searchIndex
try {
  searchIndex = JSON.parse(searchIndexRaw)
} catch (error) {
  throw new Error(`Search index is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
}
const searchItems = Object.values(searchIndex?.languages ?? {})
  .reduce((total, language) => total + Number(language?.page_count ?? 0), 0)
if (searchItems === 0) throw new Error('Pagefind index has no indexed pages')
const imageDirectory = path.join(client, 'assets/nib')
const imageFiles = await filesUnder(imageDirectory)
const imageBytes = (await Promise.all(imageFiles.map(async (file) => (await stat(file)).size)))
  .reduce((total, size) => total + size, 0)
const homeImagePaths = [...index.matchAll(/\ssrc="(\/assets\/nib\/[^"]+)"/g)]
  .map((match) => path.join(client, match[1].replace(/^\//, '')))
const homePrimaryImageBytes = (await Promise.all(homeImagePaths.map(async (file) => (await stat(file)).size)))
  .reduce((total, size) => total + size, 0)
const staticArticle = await readFile(path.join(client, 'daily-highlight-productivity-technique'), 'utf8')
const codeArticle = await readFile(path.join(client, 'convocards-launch-retro'), 'utf8')
const mermaidArticle = await readFile(path.join(client, 'heap'), 'utf8')
const mediaArticle = await readFile(path.join(client, 'central-pacific-update'), 'utf8')
const galleryPages = {
  photos: await readFile(path.join(client, 'photos'), 'utf8'),
  art: await readFile(path.join(client, 'art'), 'utf8'),
}
const visualStylesheetPaths = [...mermaidArticle.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)]
  .map(([, href]) => new URL(href, 'http://nib.local').pathname)
  .filter((href) => href.startsWith('/assets/'))
const visualStylesheets = (await Promise.all(visualStylesheetPaths.map((href) => (
  readFile(path.join(client, href.replace(/^\//, '')), 'utf8')
)))).join('\n')
const visualStylesheetAssertions = {
  markdownAlerts:
    visualStylesheets.includes('.markdown-alert')
    && visualStylesheets.includes('--alert-note-color'),
  mermaidDarkMode:
    visualStylesheets.includes('.dark svg[id^=mermaid] .node')
    && visualStylesheets.includes('.dark svg[id^=mermaid] .flowchart-link'),
  katexLayout:
    visualStylesheets.includes('.katex-html')
    && visualStylesheets.includes('font-family:KaTeX_Main'),
}
const failedVisualStylesheetAssertions = Object.entries(visualStylesheetAssertions)
  .filter(([, ok]) => !ok)
  .map(([name]) => name)
if (failedVisualStylesheetAssertions.length > 0) {
  throw new Error(`Visual stylesheet build assertions failed: ${failedVisualStylesheetAssertions.join(', ')}`)
}

function countResponsiveImageFeatures(html) {
  return {
    pictures: (html.match(/<picture>/g) ?? []).length,
    srcsets: (html.match(/srcset=/gi) ?? []).length,
    sizes: (html.match(/\ssizes="[^"]+"/g) ?? []).length,
    widthAttrs: (html.match(/<img\b[^>]*\swidth="\d+"/g) ?? []).length,
    heightAttrs: (html.match(/<img\b[^>]*\sheight="\d+"/g) ?? []).length,
    avif: (html.match(/type="image\/avif"/g) ?? []).length,
    webp: (html.match(/type="image\/webp"/g) ?? []).length,
    lazy: (html.match(/loading="lazy"/g) ?? []).length,
    leakedHints: (html.match(/data-nib-widths=/g) ?? []).length,
  }
}

function responsiveWidthCaps(html) {
  return [...html.matchAll(/<picture>([\s\S]*?)<\/picture>/g)].map(([, picture]) => {
    const widths = [...picture.matchAll(/\s(\d+)w/g)].map(([, width]) => Number(width))
    if (widths.length === 0) throw new Error('Responsive picture has no width descriptors')
    return Math.max(...widths)
  })
}

function intrinsicImageWidths(html) {
  return [...html.matchAll(/<img\b[^>]*\swidth="(\d+)"/g)].map(([, width]) => Number(width))
}

const pictureCount = (index.match(/<picture>/g) ?? []).length
const srcsetCount = (index.match(/srcset=/gi) ?? []).length
const lazyCount = (index.match(/loading="lazy"/g) ?? []).length
const priorityCount = (index.match(/fetchPriority="high"/g) ?? []).length
const formatCount = (format) => (index.match(new RegExp(`type="image/${format}"`, 'g')) ?? []).length
const internalRoutes = new Set()
const pageIssues = []

function routeArtifactCandidates(href) {
  const pathname = new URL(href, 'http://nib.local').pathname
  if (pathname === '/') return ['index.html']
  const relative = pathname.replace(/^\/+/, '')
  return [relative, `${relative}/index.html`]
}

for (const file of pageFiles) {
  const html = await readFile(file, 'utf8')
  for (const [, href] of html.matchAll(/\shref="([^"]+)"/g)) {
    if (href.startsWith('/') && !href.startsWith('/@nib-images/') && !href.startsWith('/assets/')) {
      internalRoutes.add(href)
    }
  }
  if (/<meta\s+http-equiv="refresh"/i.test(html)) continue
  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length
  const missingAltCount = [...html.matchAll(/<img\b([^>]+)>/g)]
    .filter(([, attributes]) => !/\salt="/i.test(attributes)).length
  if ((html.match(/<title>/g) ?? []).length !== 1 || h1Count < 1 || missingAltCount > 0) {
    pageIssues.push({
      file: path.relative(client, file),
      h1Count,
      missingAltCount,
    })
  }
}

const brokenInternalRoutes = [...internalRoutes].filter((href) => (
  !routeArtifactCandidates(href).some((candidate) => fileSet.has(path.join(client, candidate)))
))

// Gallery routes (photos / art / pin-collection) must ship optimized pictures
// with per-use responsive ladders, intrinsic dimensions, and authored sizes.
const galleryRouteFeatures = {}
const galleryWidthCaps = {}
const galleryIntrinsicWidths = {}
const pinCollectionHtml = await readFile(path.join(client, 'pin-collection'), 'utf8')
const pinStylesheetPaths = [...pinCollectionHtml.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)]
  .map(([, href]) => href)
  .filter((href) => href.startsWith('/assets/'))
const pinStylesheets = (await Promise.all(pinStylesheetPaths.map((href) => (
  readFile(path.join(client, href.replace(/^\//, '')), 'utf8')
)))).join('\n')
const pinFilterAssertions = {
  oneGrid: (pinCollectionHtml.match(/id="pin-grid"/g) ?? []).length === 1,
  behavior:
    pinCollectionHtml.includes('data-behavior="pin-filter"')
    && !pinCollectionHtml.includes('data-island="pin-filter"'),
  searchInput: pinCollectionHtml.includes('id="pin-search-input"'),
  favoritesToggle: pinCollectionHtml.includes('id="favorites-toggle"'),
  status: pinCollectionHtml.includes('id="pin-filter-status"'),
  noResults: pinCollectionHtml.includes('id="pin-no-results"'),
  dialog: pinCollectionHtml.includes('id="pin-modal"'),
  visualStyles:
    pinStylesheets.includes('.pin-map-wrap-default')
    && pinStylesheets.includes('.display-case')
    && pinStylesheets.includes('.pin-detail-dialog'),
}
const failedPinFilterAssertions = Object.entries(pinFilterAssertions)
  .filter(([, ok]) => !ok)
  .map(([name]) => name)
if (failedPinFilterAssertions.length > 0) {
  throw new Error(`Pin collection build assertions failed: ${failedPinFilterAssertions.join(', ')}`)
}

for (const route of ['photos', 'art', 'pin-collection']) {
  const html = await readFile(path.join(client, route), 'utf8')
  galleryRouteFeatures[route] = countResponsiveImageFeatures(html)
  galleryWidthCaps[route] = responsiveWidthCaps(html)
  galleryIntrinsicWidths[route] = intrinsicImageWidths(html)
  const features = galleryRouteFeatures[route]
  if (features.pictures === 0) throw new Error(`/${route} has no optimized <picture> output`)
  if (features.srcsets === 0) throw new Error(`/${route} has no responsive srcset`)
  if (features.sizes === 0) throw new Error(`/${route} has no authored sizes attribute`)
  if (features.widthAttrs === 0 || features.heightAttrs === 0) {
    throw new Error(`/${route} is missing intrinsic width/height dimensions`)
  }
  if (features.leakedHints > 0) throw new Error(`/${route} leaked a data-nib-widths hint into output`)
  if (galleryWidthCaps[route].length !== features.pictures) {
    throw new Error(`/${route} has a responsive picture without measurable width candidates`)
  }
  if (galleryIntrinsicWidths[route].length !== features.pictures) {
    throw new Error(`/${route} has a responsive picture without an intrinsic width`)
  }
}

const markdownFeatureAssertions = {
  articleEnhancementsBehavior:
    staticArticle.includes('data-behavior="content-enhancements"')
    && !staticArticle.includes('data-island="content-enhancements"'),
  shikiCodeBlocks: codeArticle.includes('class="astro-code github-dark"') && codeArticle.includes('data-language="tsx"'),
  copyButtons: codeArticle.includes('data-copy-button="true"') || codeArticle.includes('data-copy-button'),
  tweetCards: codeArticle.includes('class="not-prose tweet-embed"') && codeArticle.includes('class="tweet-card"'),
  mermaidSsrIsSemantic:
    (mermaidArticle.match(/<svg id="mermaid-\d+"/g) ?? []).length === 38
    && (mermaidArticle.match(/aria-roledescription="flowchart-v2"/g) ?? []).length === 38
    && !mermaidArticle.includes('language-mermaid'),
  youtubeShortcodes: mediaArticle.includes('youtube.com/embed/') && !mediaArticle.includes('{{video'),
  photoSwipeAnchors: galleryPages.photos.includes('data-pswp-width') && galleryPages.photos.includes('data-pswp-height'),
  artPhotoSwipeAnchors: galleryPages.art.includes('data-pswp-width') && galleryPages.art.includes('data-pswp-height'),
  galleryBehaviors:
    galleryPages.photos.includes('data-behavior="photo-gallery"')
    && galleryPages.art.includes('data-behavior="art-gallery"')
    && !galleryPages.photos.includes('data-island="gallery"')
    && !galleryPages.art.includes('data-island="gallery"'),
}
const failedMarkdownFeatureAssertions = Object.entries(markdownFeatureAssertions)
  .filter(([, ok]) => !ok)
  .map(([name]) => name)
if (failedMarkdownFeatureAssertions.length > 0) {
  throw new Error(`Markdown/gallery feature assertions failed: ${failedMarkdownFeatureAssertions.join(', ')}`)
}

const photoCaps = galleryWidthCaps.photos
const photoWidths = galleryIntrinsicWidths.photos
if (photoWidths.some((width) => width > 1920) || photoCaps.some((width) => width > 1200)) {
  throw new Error(`/photos cells exceed the source image policy: ${JSON.stringify({ maxIntrinsic: Math.max(...photoWidths), maxCandidate: Math.max(...photoCaps) })}`)
}
if (galleryIntrinsicWidths.art.some((width) => width > 5787) || galleryWidthCaps.art.some((width) => width > 1200)) {
  throw new Error(`/art cells exceed the source image policy: ${JSON.stringify({ maxIntrinsic: Math.max(...galleryIntrinsicWidths.art), maxCandidate: Math.max(...galleryWidthCaps.art) })}`)
}
if (galleryIntrinsicWidths['pin-collection'].some((width) => width > 240) || galleryWidthCaps['pin-collection'].some((width) => width > 240)) {
  throw new Error(`/pin-collection cards exceed their slot-sized image policy: ${JSON.stringify({ maxIntrinsic: Math.max(...galleryIntrinsicWidths['pin-collection']), maxCandidate: Math.max(...galleryWidthCaps['pin-collection']) })}`)
}

// RSS details that mirror the original Astro feed.
const rssAssertions = {
  stylesheet: rss.includes('<?xml-stylesheet type="text/xsl" href="/rss/styles.xsl"?>'),
  dcNamespace: rss.includes('xmlns:dc="http://purl.org/dc/elements/1.1/"'),
  atomNamespace: rss.includes('xmlns:atom="http://www.w3.org/2005/Atom"'),
  contentNamespace: rss.includes('xmlns:content="http://purl.org/rss/1.0/modules/content/"'),
  language: rss.includes('<language>en-us</language>'),
  copyright: /<copyright>© \d{4} Brian Sunter<\/copyright>/.test(rss),
  managingEditor: rss.includes('<managingEditor>noreply@briansunter.com (Brian Sunter)</managingEditor>'),
  webMaster: rss.includes('<webMaster>noreply@briansunter.com (Brian Sunter)</webMaster>'),
  creator: rss.includes('<dc:creator><![CDATA[Brian Sunter]]></dc:creator>'),
  encoded: rss.includes('<content:encoded><![CDATA['),
  coverImage: rss.includes('<p><img src="https://briansunter.com/site-assets/'),
}
const failedRssAssertions = Object.entries(rssAssertions)
  .filter(([, ok]) => !ok)
  .map(([name]) => name)
if (failedRssAssertions.length > 0) {
  throw new Error(`RSS parity assertions failed: ${failedRssAssertions.join(', ')}`)
}

if (pictureCount < 2) throw new Error(`Expected multiple responsive pictures, received ${pictureCount}`)
if (srcsetCount < 2) throw new Error(`Expected responsive srcsets, received ${srcsetCount}`)
if (formatCount('avif') === 0 || formatCount('webp') === 0) throw new Error('Expected AVIF and WebP candidates')
if (lazyCount === 0 || priorityCount === 0) throw new Error('Expected both lazy and priority image loading')
if (!rss.includes('<rss version="2.0"') || !rss.includes('<item>')) throw new Error('RSS output is missing items')
if (brokenInternalRoutes.length > 0) throw new Error(`Broken internal routes: ${brokenInternalRoutes.join(', ')}`)
if (pageIssues.length > 0) throw new Error(`Page accessibility issues: ${JSON.stringify(pageIssues)}`)

console.log(JSON.stringify({
  htmlRoutes: htmlFiles.length + extensionlessPageFiles.length,
  responsivePicturesOnHome: pictureCount,
  responsiveSrcsetsOnHome: srcsetCount,
  avifCandidatesOnHome: formatCount('avif'),
  webpCandidatesOnHome: formatCount('webp'),
  lazyImagesOnHome: lazyCount,
  priorityImagesOnHome: priorityCount,
  galleryRouteFeatures,
  galleryWidthCaps: Object.fromEntries(Object.entries(galleryWidthCaps).map(([route, widths]) => [route, {
    max: Math.max(...widths),
    unique: [...new Set(widths)].sort((left, right) => left - right),
  }])),
  galleryIntrinsicWidths: Object.fromEntries(Object.entries(galleryIntrinsicWidths).map(([route, widths]) => [route, {
    max: Math.max(...widths),
    unique: [...new Set(widths)].sort((left, right) => left - right),
  }])),
  pinFilterAssertions,
  rssParity: rssAssertions,
  optimizedAssetCount: imageFiles.length,
  optimizedAssetBytes: imageBytes,
  homepageChosenFallbackImageBytes: homePrimaryImageBytes,
  rssItems: (rss.match(/<item>/g) ?? []).length,
  searchItems,
  internalLinkCount: internalRoutes.size,
  brokenInternalRoutes,
  pageIssues,
  visualStylesheetAssertions,
  markdownFeatureAssertions,
}, null, 2))
