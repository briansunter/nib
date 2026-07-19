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
  && path.extname(file) === ''
))
const pageFiles = [...new Set([...htmlFiles, ...extensionlessPageFiles])]
const fileSet = new Set(allFiles)
const index = await readFile(path.join(client, 'index.html'), 'utf8')
const rss = await readFile(path.join(client, 'rss.xml'), 'utf8')
const imageDirectory = path.join(client, 'assets/nib')
const imageFiles = await filesUnder(imageDirectory)
const imageBytes = (await Promise.all(imageFiles.map(async (file) => (await stat(file)).size)))
  .reduce((total, size) => total + size, 0)
const homeImagePaths = [...index.matchAll(/\ssrc="(\/assets\/nib\/[^\"]+)"/g)]
  .map((match) => path.join(client, match[1].replace(/^\//, '')))
const homePrimaryImageBytes = (await Promise.all(homeImagePaths.map(async (file) => (await stat(file)).size)))
  .reduce((total, size) => total + size, 0)
const staticArticle = await readFile(path.join(client, 'notes/daily-highlight'), 'utf8')

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
  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length
  const missingAltCount = [...html.matchAll(/<img\b([^>]+)>/g)]
    .filter(([, attributes]) => !/\salt="/i.test(attributes)).length
  if ((html.match(/<title>/g) ?? []).length !== 1 || h1Count !== 1 || missingAltCount > 0) {
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

if (pictureCount < 2) throw new Error(`Expected multiple responsive pictures, received ${pictureCount}`)
if (srcsetCount < 2) throw new Error(`Expected responsive srcsets, received ${srcsetCount}`)
if (formatCount('avif') === 0 || formatCount('webp') === 0) throw new Error('Expected AVIF and WebP candidates')
if (lazyCount === 0 || priorityCount === 0) throw new Error('Expected both lazy and priority image loading')
if (!rss.includes('<rss version="2.0"') || !rss.includes('<item>')) throw new Error('RSS output is missing items')
if (staticArticle.includes('data-nib-islands')) throw new Error('Markdown article unexpectedly shipped the island runtime')
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
  optimizedAssetCount: imageFiles.length,
  optimizedAssetBytes: imageBytes,
  homepageChosenFallbackImageBytes: homePrimaryImageBytes,
  rssItems: (rss.match(/<item>/g) ?? []).length,
  internalLinkCount: internalRoutes.size,
  brokenInternalRoutes,
  pageIssues,
  staticMarkdownRouteHasNoIslandRuntime: true,
}, null, 2))
