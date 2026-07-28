// Deterministic content import for the Nib personal-site replica.
//
// Reads the canonical Astro site at $PERSONAL_SITE_SRC (default
// /Volumes/Storage/code/personal-site) and emits build-time content into this
// replica: normalized Markdown writing pages, project/recipe JSON, gallery
// data, source images under src/assets/site-assets, and curated nib-image
// sources. The output is committed; the build never reads the source site.
//
// Run: bun run import:content
import { readFile, writeFile, mkdir, readdir, copyFile, rm, cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import {
  cookware_display_name,
  ingredient_display_name,
  Parser,
  quantity_display,
} from '@cooklang/cooklang'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPLICA = path.resolve(__dirname, '..')
const SOURCE = process.env.PERSONAL_SITE_SRC
  ? path.resolve(process.env.PERSONAL_SITE_SRC)
  : '/Volumes/Storage/code/personal-site'

const SRC_PAGES = path.join(SOURCE, 'src/data/pages')
const SRC_PROJECTS = path.join(SOURCE, 'src/data/projects')
const SRC_RECIPES = path.join(SOURCE, 'src/data/recipes')
const SRC_ART = path.join(SOURCE, 'src/data/art')
const SRC_PHOTOS = path.join(SOURCE, 'src/data/photos')
const SRC_PINS = path.join(SOURCE, 'src/data/pin-collection')
const SRC_TRAVEL = path.join(SOURCE, 'src/data/travel')
const SRC_IMAGES = path.join(SOURCE, 'src/assets/images')
const SRC_VIDEOS = path.join(SOURCE, 'src/assets/videos')
const SRC_PUBLIC = path.join(SOURCE, 'public')
const SRC_DIST = path.join(SOURCE, 'dist')

const OUT_PAGES = path.join(REPLICA, 'src/pages')
const OUT_CONTENT = path.join(REPLICA, 'src/content')
const OUT_ASSETS = path.join(REPLICA, 'src/assets/site-assets')
const OUT_VIDEOS = path.join(REPLICA, 'public/videos')
const OUT_CURATED = path.join(REPLICA, 'src/assets/images/curated')
const OUT_PUBLIC = path.join(REPLICA, 'public')
const OUT_INTEGRATION_STYLES = path.join(REPLICA, 'src/styles/integrations')
const OUT_UTILS = path.join(REPLICA, 'src/utils')

const copiedImages = new Set()
const copiedVideos = new Set()
async function exists(file) {
  return existsSync(file)
}
async function copyImage(rel) {
  // rel is repo-relative under src/assets/images/...
  const src = path.join(SRC_IMAGES, rel)
  if (!(await exists(src))) return null
  const dest = path.join(OUT_ASSETS, rel)
  await mkdir(path.dirname(dest), { recursive: true })
  if (!copiedImages.has(dest)) {
    await copyFile(src, dest)
    copiedImages.add(dest)
  }
  return `/site-assets/${rel.split(path.sep).join('/')}`
}

async function copyCurated(rel, key) {
  const src = path.join(SRC_IMAGES, rel)
  if (!(await exists(src))) return null
  const ext = path.extname(rel)
  const dest = path.join(OUT_CURATED, `${key}${ext}`)
  await mkdir(OUT_CURATED, { recursive: true })
  if (!(await exists(dest))) await copyFile(src, dest)
  // Relative to src/data/images.ts where the import is consumed.
  return `../assets/images/curated/${key}${ext}`
}

async function copyVideo(rel) {
  const normalized = rel
    .replace(/^\.\.\/\.\.\/assets\/videos\//, '')
    .replace(/^assets\/videos\//, '')
    .replace(/^videos\//, '')
    .replace(/^\/+/, '')
  if (!normalized || normalized.includes('..')) return null
  const src = path.join(SRC_VIDEOS, normalized)
  if (!(await exists(src))) return null
  const dest = path.join(OUT_VIDEOS, normalized)
  await mkdir(path.dirname(dest), { recursive: true })
  if (!copiedVideos.has(dest)) {
    await copyFile(src, dest)
    copiedVideos.add(dest)
  }
  return `/videos/${normalized.split(path.sep).join('/')}`
}

async function readDir(dir) {
  return (await readdir(dir)).sort()
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: source }
  return { data: parseYaml(match[1]) ?? {}, body: match[2] }
}

function asArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function cleanSlug(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '-')
}

function stripPageSuffix(tag) {
  return String(tag).replace(/-page$/i, '')
}

function normalizePageTag(tag) {
  return stripPageSuffix(tag).toLowerCase().trim()
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[\s/\\_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function tagToSlug(tag) {
  return slugify(stripPageSuffix(tag))
}

// Rewrite writing markdown: image URLs to /site-assets, Obsidian embeds and
// wikilinks resolved against the writing slug set.
function normalizeImageRef(ref) {
  return ref
    .replace(/^\.\.\/\.\.\/assets\/images\//, '')
    .replace(/^assets\/images\//, '')
    .replace(/^images\//, '')
    .replace(/^\.\.\/\.\.\/[\w/-]+\/images\//, '')
}

function normalizeVideoRef(ref) {
  return ref
    .replace(/^\.\.\/\.\.\/assets\/videos\//, '')
    .replace(/^assets\/videos\//, '')
    .replace(/^videos\//, '')
    .replace(/^\/+/, '')
}

function rewriteVideoEmbeds(body) {
  return body.replace(
    /!\[([^\]]*)\]\(([^)\s]+\.(?:mp4|m4v|webm|mov))\)/gi,
    (_full, alt, url) => {
      const source = `/videos/${normalizeVideoRef(url.trim())}`
      return `![${alt}](${source})`
    },
  )
}

export function rewriteWritingMarkdown(body) {
  let out = rewriteVideoEmbeds(body)
  // Obsidian embeds: ![[File.png]] or ![[File.png|alt]]
  out = out.replace(/!\[\[([^\]]+)\]\]/g, (_full, inner) => {
    const [file, alt] = inner.split('|')
    const target = normalizeImageRef(file.trim())
    return `![${alt ?? ''}](/site-assets/${target})`
  })
  // Leave wikilinks intact. The target's remark-wiki-link pass resolves them
  // from parsed Markdown nodes, which preserves literal [[...]] payloads in
  // inline code and fenced code blocks.
  // Standard markdown images: ![alt](../../assets/images/X) -> /site-assets/X
  out = out.replace(/(!\[[^\]]*]\()([^)]+)(\))/g, (_m, head, url, tail) => {
    const trimmed = url.trim()
    if (trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed)) {
      return `${head}${trimmed}${tail}`
    }
    const target = normalizeImageRef(trimmed)
    return `${head}/site-assets/${target}${tail}`
  })
  return out
}

async function importWriting() {
  const files = (await readDir(SRC_PAGES)).filter((f) => f.endsWith('.md'))
  const entries = []
  for (const file of files) {
    const source = await readFile(path.join(SRC_PAGES, file), 'utf8')
    const { data, body } = parseFrontmatter(source)
    const slug = cleanSlug(data.slug ?? file.replace(/\.md$/, ''))
    entries.push({ file, data, body, slug })
  }
  // Second pass: rewrite bodies after the complete source inventory is read.
  for (const entry of entries) {
    const { slug, data, body } = entry
    const title = (data.pageTitle || data.title || slug).toString().trim()
    const description = (data.description || '').toString().trim()
    const date = data.date ? new Date(data.date).toISOString() : null
    const lastMod = data.lastMod ? new Date(data.lastMod).toISOString() : null
    const math = Boolean(data.math)
    const tags = asArray(data.tags).map(String)
    const coverRel = data.coverImage ? normalizeImageRef(String(data.coverImage)) : null
    const cover = coverRel ? await copyImage(coverRel) : null
    const rewritten = rewriteWritingMarkdown(body)
    const wordCount = body.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu)?.length ?? 0
    // Copy referenced images so the rewritten URLs resolve.
    for (const rel of [...rewritten.matchAll(/\/site-assets\/([^)\s"']+)/g)].map((m) => m[1])) {
      await copyImage(rel)
    }
    for (const rel of [...rewritten.matchAll(/\/videos\/([^\s"'<>]+)/g)].map((m) => m[1])) {
      await copyVideo(rel)
    }
    const frontmatter = [
      '---',
      `title: ${JSON.stringify(title)}`,
      description ? `description: ${JSON.stringify(description)}` : null,
      date ? `date: ${date}` : null,
      lastMod ? `lastMod: ${lastMod}` : null,
      math ? 'math: true' : null,
      cover ? `cover: ${JSON.stringify(cover)}` : null,
      `wordCount: ${wordCount}`,
      tags.length ? `tags:\n${tags.map((t) => `  - ${JSON.stringify(t)}`).join('\n')}` : null,
      'layout: article',
      '---',
      '',
    ].filter(Boolean).join('\n')
    const dir = path.join(OUT_PAGES, slug)
    await mkdir(dir, { recursive: true })
    const bodySeparator = rewritten.startsWith('\n') ? '' : '\n'
    await writeFile(
      path.join(dir, 'page.md'),
      `${frontmatter}${bodySeparator}${rewritten.trimEnd()}\n`,
    )
    entries[entries.indexOf(entry)] = {
      slug,
      title,
      description,
      date,
      lastMod,
      math,
      tags,
      cover,
      wordCount,
    }
  }
  // Sort newest first for the archive/RSS.
  entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  console.log(`writing: ${entries.length} pages`)
  return entries
}

async function importProjects() {
  const files = (await readDir(SRC_PROJECTS)).filter((f) => f.endsWith('.md'))
  const projects = []
  for (const file of files) {
    const source = await readFile(path.join(SRC_PROJECTS, file), 'utf8')
    const { data, body } = parseFrontmatter(source)
    const slug = file.replace(/\.md$/, '')
    const title = (data.pageTitle || data.title || slug).toString().trim()
    const description = (data.description || '').toString().trim()
    const date = data.date ? new Date(data.date).toISOString() : null
    const tags = asArray(data.tags).filter((t) => t !== 'project-page').map(String)
    const featured = Boolean(data.featured)
    const projectUrl = data.projectUrl || undefined
    const github = data.github || undefined
    // Cover image
    let coverUrl = null
    let coverFile = null
    const coverRel = data.coverImage ? data.coverImage.replace(/^\.\.\/\.\.\/assets\/images\//, '') : null
    if (coverRel) {
      coverUrl = await copyImage(coverRel)
      if (featured) {
        coverFile = await copyCurated(coverRel, slug)
      }
    }
    // Body markdown -> HTML with image URLs rewritten to site-assets
    let bodyMarkdown = body
    bodyMarkdown = bodyMarkdown.replace(/\]\((\.\.\/\.\.\/)?(assets\/)?images\/([^)]+)\)/g, (_m, _a, _b, rest) => `](/site-assets/${rest})`)
    for (const rel of [...bodyMarkdown.matchAll(/\/site-assets\/([^)\s"']+)/g)].map((m) => m[1])) {
      await copyImage(rel)
    }
    projects.push({
      slug,
      title,
      description,
      date,
      tags,
      featured,
      ...(projectUrl ? { projectUrl } : {}),
      ...(github ? { github } : {}),
      cover: coverUrl,
      coverFile,
      bodyMarkdown,
    })
  }
  await mkdir(OUT_CONTENT, { recursive: true })
  await writeFile(
    path.join(OUT_CONTENT, 'projects.json'),
    `${JSON.stringify(projects, null, 2)}\n`,
  )
  console.log(`projects: ${projects.length} entries`)
  return projects
}

function roundQuantity(quantity) {
  if (typeof quantity === 'string') {
    const value = quantity.trim()
    if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return quantity
    return Math.round(Number.parseFloat(value) * 100) / 100
  }
  return typeof quantity === 'number' ? Math.round(quantity * 100) / 100 : quantity
}

function parseNumericValue(value) {
  if (!value || typeof value !== 'object') return null
  if (value.type === 'regular') return typeof value.value === 'number' ? value.value : null
  if (value.type === 'fraction') {
    const fraction = value.value
    if (fraction && fraction.den !== 0) return fraction.whole + fraction.num / fraction.den
  }
  return null
}

function legacyQuantity(quantity, fallback = 1) {
  if (!quantity) return fallback
  const value = quantity.value
  if (value?.type === 'number') {
    const numeric = parseNumericValue(value.value)
    if (numeric !== null) return roundQuantity(numeric)
  }
  if (value?.type === 'range') {
    const start = parseNumericValue(value.value?.start)
    const end = parseNumericValue(value.value?.end)
    if (start !== null && end !== null) {
      const a = roundQuantity(start)
      const b = roundQuantity(end)
      return a === b ? a : `${a}-${b}`
    }
  }
  if (value?.type === 'text' && typeof value.value === 'string') return value.value
  return quantity_display(quantity) || fallback
}

function legacyIngredient(ingredient) {
  return {
    type: 'ingredient',
    name: ingredient_display_name(ingredient),
    quantity: legacyQuantity(ingredient.quantity),
    units: typeof ingredient.quantity?.unit === 'string' ? ingredient.quantity.unit : '',
  }
}

function legacyCookware(cookware) {
  return {
    type: 'cookware',
    name: cookware_display_name(cookware),
    quantity: legacyQuantity(cookware.quantity),
  }
}

function legacyTimer(timer) {
  return {
    type: 'timer',
    quantity: legacyQuantity(timer.quantity),
    units: typeof timer.quantity?.unit === 'string' ? timer.quantity.unit : '',
  }
}

function legacyStepItem(item, recipe) {
  if (item.type === 'text') return { type: 'text', value: item.value }
  if (item.type === 'ingredient') {
    const ingredient = recipe.ingredients[item.index]
    return ingredient ? legacyIngredient(ingredient) : null
  }
  if (item.type === 'cookware') {
    const cookware = recipe.cookware[item.index]
    return cookware ? legacyCookware(cookware) : null
  }
  if (item.type === 'timer') {
    const timer = recipe.timers[item.index]
    return timer ? legacyTimer(timer) : null
  }
  if (item.type === 'inlineQuantity') {
    const quantity = recipe.inline_quantities[item.index]
    return quantity ? { type: 'text', value: quantity_display(quantity) } : null
  }
  return null
}

function parseCooklang(source) {
  const parsed = new Parser().parse(source).recipe
  const blocks = []
  for (const section of parsed.sections) {
    const name = typeof section.name === 'string' ? section.name.trim() : ''
    if (name) blocks.push({ type: 'section', name })
    for (const content of section.content) {
      if (content.type === 'step') {
        blocks.push({
          type: 'step',
          items: content.value.items
            .map((item) => legacyStepItem(item, parsed))
            .filter(Boolean),
        })
      } else if (content.type === 'text') {
        const text = content.value.trim()
        if (text) blocks.push({ type: 'note', text })
      }
    }
  }
  const frontmatter = parseFrontmatter(source).data
  return {
    metadata: { ...parsed.raw_metadata.map, ...frontmatter },
    ingredients: parsed.ingredients.map(legacyIngredient),
    cookwares: parsed.cookware.map(legacyCookware),
    steps: blocks.filter((block) => block.type === 'step').map((block) => block.items),
    blocks,
    cooklang: source,
  }
}

export function calculateRecipeTime(steps) {
  let minutes = 0
  for (const step of steps) {
    for (const item of step) {
      if (item.type !== 'timer') continue
      const quantity = typeof item.quantity === 'string' ? Number.parseFloat(item.quantity) : item.quantity
      if (!(quantity > 0)) continue
      const units = item.units.toLowerCase().trim()
      if (units.startsWith('hour') || units === 'h' || units === 'hr') minutes += quantity * 60
      else if (units.startsWith('second') || units === 's' || units === 'sec') minutes += quantity / 60
      else minutes += quantity
    }
  }
  if (minutes <= 0) return undefined
  if (minutes < 1) return `${Math.round(minutes * 60)} seconds`
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (hours === 0) return `${rest} min`
  if (rest === 0) return hours === 1 ? '1 hour' : `${hours} hours`
  return `${hours}h ${rest}m`
}

export function normalizeRecipeMetadata(meta, slug) {
  const metadata = {
    ...meta,
    title: String(meta.title || slug),
    description: String(meta.description || ''),
    tags: (Array.isArray(meta.tags) ? meta.tags : String(meta.tags ?? '').split(','))
      .map((tag) => String(tag).trim())
      .filter(Boolean),
  }
  if (meta.servings != null && meta.servings !== '') {
    metadata.servings = String(meta.servings)
  }

  const aliases = {
    prepTime: ['prepTime', 'prep time', 'prep-time'],
    cookTime: ['cookTime', 'cook time', 'cook-time'],
    totalTime: ['totalTime', 'total time', 'total-time'],
    bakeTime: ['bakeTime', 'bake time'],
    restTime: ['restTime', 'rest time'],
    marinateTime: ['marinateTime', 'marinate time', 'marinating time', 'marinade time'],
    time: ['time', 'time required'],
    servings: ['servings', 'serves'],
    source: ['source', 'url'],
    longDescription: ['longDescription', 'long description', 'long-description', 'long_description'],
  }
  for (const [canonical, keys] of Object.entries(aliases)) {
    const value = keys.map((key) => meta[key]).find((candidate) => candidate != null && candidate !== '')
    if (value != null) metadata[canonical] = String(value)
  }
  return metadata
}

export async function importRecipes() {
  const files = (await readDir(SRC_RECIPES)).filter((f) => f.endsWith('.cook'))
  const recipes = []
  for (const file of files) {
    const source = await readFile(path.join(SRC_RECIPES, file), 'utf8')
    const slug = file.replace(/\.cook$/, '')
    const parsed = parseCooklang(source)
    const meta = parsed.metadata || {}
    const metadata = normalizeRecipeMetadata(meta, slug)
    if (!metadata.prepTime && !metadata.cookTime && !metadata.totalTime) {
      metadata.totalTime = calculateRecipeTime(parsed.steps)
    }
    recipes.push({
      slug,
      metadata,
      ingredients: parsed.ingredients,
      cookwares: parsed.cookwares,
      steps: parsed.steps,
      blocks: parsed.blocks,
      cooklang: parsed.cooklang,
    })
  }
  recipes.sort((a, b) => a.metadata.title.localeCompare(b.metadata.title))
  await mkdir(OUT_CONTENT, { recursive: true })
  await writeFile(
    path.join(OUT_CONTENT, 'recipes.json'),
    `${JSON.stringify(recipes, null, 2)}\n`,
  )
  console.log(`recipes: ${recipes.length} entries`)
  return recipes
}

async function resolveImageField(value) {
  if (!value) return null
  const rel = String(value).replace(/^\.\.\/\.\.\/assets\/images\//, '')
  return copyImage(rel)
}

async function importGalleries() {
  const galleryImagePaths = new Set()
  const remember = (url) => { if (typeof url === 'string' && url.startsWith('/site-assets/')) galleryImagePaths.add(url.slice('/site-assets/'.length)) }

  // Art
  const artFiles = (await readDir(SRC_ART)).filter((f) => f.endsWith('.yaml'))
  const art = []
  for (const file of artFiles) {
    const data = parseYaml(await readFile(path.join(SRC_ART, file), 'utf8'))
    const id = file.replace(/\.yaml$/, '')
    const cover = await resolveImageField(data.cover)
    remember(cover)
    const artworks = []
    for (const item of data.artworks ?? []) {
      const img = await resolveImageField(item.filename)
      remember(img)
      artworks.push({
        title: item.title || '',
        description: item.description || '',
        medium: item.medium || '',
        dimensions: item.dimensions || '',
        surface: item.surface || '',
        location: item.location || '',
        date: item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
        tags: asArray(item.tags).map(String),
        image: img,
      })
    }
    art.push({
      id,
      name: data.name,
      description: data.description || '',
      default: Boolean(data.default),
      date: data.date ? new Date(data.date).toISOString().slice(0, 10) : '',
      medium: data.medium || '',
      tags: asArray(data.tags).map(String),
      cover,
      artworks,
    })
  }
  await writeFile(path.join(OUT_CONTENT, 'art.json'), `${JSON.stringify(art, null, 2)}\n`)
  console.log(`art: ${art.reduce((n, c) => n + c.artworks.length, 0)} artworks in ${art.length} collections`)

  // Photos
  const photoFiles = (await readDir(SRC_PHOTOS)).filter((f) => f.endsWith('.yaml'))
  const photos = []
  for (const file of photoFiles) {
    const data = parseYaml(await readFile(path.join(SRC_PHOTOS, file), 'utf8'))
    const id = file.replace(/\.yaml$/, '')
    const cover = await resolveImageField(data.cover)
    remember(cover)
    const items = []
    for (const item of data.photos ?? []) {
      const img = await resolveImageField(item.filename)
      remember(img)
      items.push({
        title: item.title || '',
        description: item.description || '',
        tags: asArray(item.tags).map(String),
        image: img,
      })
    }
    photos.push({
      id,
      name: data.name,
      description: data.description || '',
      location: data.location || '',
      date: data.date ? new Date(data.date).toISOString().slice(0, 10) : '',
      ...(data.gps ? { gps: data.gps } : {}),
      tags: asArray(data.tags).map(String),
      cover,
      photos: items,
    })
  }
  await writeFile(path.join(OUT_CONTENT, 'photos.json'), `${JSON.stringify(photos, null, 2)}\n`)
  console.log(`photos: ${photos.reduce((n, c) => n + c.photos.length, 0)} photos in ${photos.length} collections`)

  // Pins
  const pinFile = (await readDir(SRC_PINS)).find((f) => f.endsWith('.yaml'))
  const pinData = pinFile ? parseYaml(await readFile(path.join(SRC_PINS, pinFile), 'utf8')) : { pins: [] }
  const pins = []
  for (const pin of pinData.pins ?? []) {
    const img = await resolveImageField(pin.image)
    remember(img)
    pins.push({
      id: pin.id,
      name: pin.name || pin.id,
      description: pin.description || '',
      image: img,
      dateAcquired: pin.date_acquired ? new Date(pin.date_acquired).toISOString().slice(0, 10) : '',
      acquiredAt: pin.acquired_at || '',
      ...(pin.gps ? { gps: pin.gps } : {}),
      source: pin.source || '',
      category: pin.category || '',
      tags: asArray(pin.tags).map(String),
      maker: pin.maker || '',
      favorite: Boolean(pin.favorite),
    })
  }
  await writeFile(path.join(OUT_CONTENT, 'pins.json'), `${JSON.stringify({ name: pinData.name, description: pinData.description, pins }, null, 2)}\n`)
  console.log(`pins: ${pins.length}`)

  // Travel
  const travelFile = (await readDir(SRC_TRAVEL)).find((f) => f.endsWith('.yaml'))
  const travelData = travelFile ? parseYaml(await readFile(path.join(SRC_TRAVEL, travelFile), 'utf8')) : {}
  const travel = {
    name: travelData.name || 'Travel',
    description: travelData.description || '',
    visitedCountries: asArray(travelData.visitedCountries).map(String),
    visitedUsStates: asArray(travelData.visitedUsStates).map(String),
    visitedChinaProvinces: asArray(travelData.visitedChinaProvinces).map(String),
    cities: asArray(travelData.cities).map((c) => ({
      id: c.id,
      name: c.name,
      countryCode: c.countryCode,
      ...(c.stateCode ? { stateCode: c.stateCode } : {}),
      ...(c.provinceCode ? { provinceCode: c.provinceCode } : {}),
      gps: c.gps,
      tags: asArray(c.tags).map(String),
    })),
  }
  await writeFile(path.join(OUT_CONTENT, 'travel.json'), `${JSON.stringify(travel, null, 2)}\n`)
  console.log(`travel: ${travel.cities.length} cities`)
  return galleryImagePaths
}

async function importGalleryRuntime() {
  const styleFiles = ['gallery.css', 'photos.css', 'art.css']
  const utilityFiles = [
    'artMasonryInitializer.ts',
    'dropdown.ts',
    'lightbox-history.ts',
    'mapInitializer.ts',
    'masonryPacker.ts',
    'photoMasonryInitializer.ts',
    'photoSwipeInitializer.ts',
    'pin-map-clustering.ts',
  ]

  await mkdir(OUT_INTEGRATION_STYLES, { recursive: true })
  await mkdir(OUT_UTILS, { recursive: true })
  for (const file of styleFiles) {
    await copyFile(
      path.join(SOURCE, 'src/styles/integrations', file),
      path.join(OUT_INTEGRATION_STYLES, file),
    )
  }
  for (const file of utilityFiles) {
    const source = await readFile(path.join(SOURCE, 'src/utils', file), 'utf8')
    const importsNormalized = source
      .replaceAll("from '@/lib/", "from '../lib/")
      .replaceAll('from "@/lib/', 'from "../lib/')
      .replaceAll("from '@/utils/", "from './")
      .replaceAll('from "@/utils/', 'from "./')
    const normalized = file === 'mapInitializer.ts'
      ? importsNormalized
          .replaceAll("leaflet/dist/images/marker-icon.png';", "leaflet/dist/images/marker-icon.png?url';")
          .replaceAll("leaflet/dist/images/marker-icon-2x.png';", "leaflet/dist/images/marker-icon-2x.png?url';")
          .replaceAll("leaflet/dist/images/marker-shadow.png';", "leaflet/dist/images/marker-shadow.png?url';")
          .replace('iconUrl: icon.src,', 'iconUrl: icon,')
          .replace('iconRetinaUrl: icon2x.src,', 'iconRetinaUrl: icon2x,')
          .replace('shadowUrl: markerShadow.src,', 'shadowUrl: markerShadow,')
      : importsNormalized
          .replace(/^import 'photoswipe\/dist\/photoswipe\.css';?\r?\n/gm, '')
          .replace(/^import '@\/styles\/integrations\/prose-lightbox\.css';?\r?\n/gm, '')
    await writeFile(path.join(OUT_UTILS, file), normalized)
  }

  for (const file of ['analytics-config.ts', 'html-utils.ts']) {
    const source = await readFile(path.join(SOURCE, 'src/lib', file), 'utf8')
    const normalized = source
      .replaceAll("from '@/utils/", "from '../utils/")
      .replaceAll('from "@/utils/', 'from "../utils/')
    await writeFile(path.join(REPLICA, 'src/lib', file), normalized)
  }
  console.log(`gallery runtime: ${styleFiles.length} styles and ${utilityFiles.length + 3} modules copied`)
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function sourceCommit() {
  const status = execFileSync('git', ['status', '--porcelain'], {
    cwd: SOURCE,
    encoding: 'utf8',
  }).trim()
  if (status) {
    throw new Error('Canonical personal-site must be clean before importing a frozen snapshot')
  }
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: SOURCE,
    encoding: 'utf8',
  }).trim()
}

async function writeSourceProvenance(commit) {
  const sourceUtilities = await filesUnder(path.join(SOURCE, 'src/utils'))
  const sharedFiles = []
  for (const sourceFile of sourceUtilities) {
    if (!sourceFile.endsWith('.ts') || sourceFile.endsWith('.test.ts')) continue
    const relative = path.relative(SOURCE, sourceFile).replaceAll(path.sep, '/')
    const replicaFile = path.join(REPLICA, relative)
    const testOwner = relative.replace(/\.ts$/, '.test.ts')
    if (!(await exists(replicaFile)) || !(await exists(path.join(SOURCE, testOwner)))) {
      continue
    }
    const sourceContent = await readFile(sourceFile)
    const replicaContent = await readFile(replicaFile)
    if (!sourceContent.equals(replicaContent)) continue
    sharedFiles.push({
      path: relative,
      sha256: sha256(sourceContent),
      testOwner,
    })
  }
  sharedFiles.sort((left, right) => left.path.localeCompare(right.path))
  await writeFile(
    path.join(OUT_CONTENT, 'source-provenance.json'),
    `${JSON.stringify({
      version: 1,
      sourceRepository: 'https://github.com/briansunter/personal-site',
      sourceCommit: commit,
      sharedFiles,
    }, null, 2)}\n`,
  )
  console.log(`source provenance: ${commit.slice(0, 12)}, ${sharedFiles.length} shared modules`)
}

// Static module of `?nib-image` imports for every gallery source file so the
// photo/art/pin grids render <Image> with intrinsic dimensions and 1x/2x
// responsive candidates instead of bare <img> tags.
async function buildGalleryImagesModule(paths) {
  const sorted = [...paths].filter(Boolean).sort()
  const lines = [
    "// Generated by scripts/import-content.mjs. Do not edit by hand.",
    "import type { ImageSource } from '@briansunter/nib-images'",
    '',
  ]
  sorted.forEach((rel, index) => {
    lines.push(`import gi${index} from '../assets/site-assets/${rel}?nib-image'`)
  })
  lines.push('')
  lines.push('export const galleryImages: Record<string, ImageSource> = {')
  sorted.forEach((rel, index) => {
    lines.push(`  '/site-assets/${rel}': gi${index},`)
  })
  lines.push('}')
  lines.push('')
  return lines.join('\n')
}

async function buildTags(writing) {
  const metaTags = new Set(['blog', 'newsletter'])
  const map = new Map()
  function add(tag, entry) {
    const display = normalizePageTag(tag)
    if (!display || metaTags.has(display)) return
    const key = tagToSlug(tag)
    if (!map.has(key)) map.set(key, { tag: key, display, entries: [] })
    map.get(key).entries.push(entry)
  }
  for (const w of writing) {
    for (const t of w.tags) add(t, w)
  }
  const tags = [...map.values()]
    .map((t) => ({ ...t, count: t.entries.length }))
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
  await mkdir(OUT_CONTENT, { recursive: true })
  await writeFile(path.join(OUT_CONTENT, 'tags.json'), `${JSON.stringify(tags, null, 2)}\n`)
  console.log(`tags: ${tags.length}`)
  return tags
}

async function buildImagesModule(projects) {
  const covered = projects.filter((project) => project.cover?.startsWith('/site-assets/'))
  const featured = projects.filter((project) => project.featured)
  const lines = [
    "import type { ImageSource } from '@briansunter/nib-images'",
    "import avatar from '../assets/avatar.jpg?nib-image'",
    "import bitcoinQrCode from '../assets/site-assets/bitcoin/bitcoin-qr-code.svg?nib-image'",
    '',
  ]
  covered.forEach((project, index) => {
    lines.push(`import pi${index} from '../assets/site-assets/${project.cover.slice('/site-assets/'.length)}?nib-image'`)
  })
  lines.push('')
  lines.push('export const imageMap: Record<string, ImageSource> = {')
  lines.push('  avatar,')
  covered.forEach((project, index) => {
    lines.push(`  ${JSON.stringify(project.slug)}: pi${index},`)
  })
  lines.push('}')
  lines.push('')
  lines.push(`export const featuredProjectSlugs = ${JSON.stringify(featured.map((p) => p.slug))}`)
  lines.push('')
  lines.push('export { avatar }')
  lines.push('export { bitcoinQrCode }')
  lines.push('')
  return lines.join('\n')
}

async function buildWritingImagesModule(writing) {
  const covered = writing.filter((entry) => entry.cover?.startsWith('/site-assets/'))
  const lines = [
    "// Generated by scripts/import-content.mjs. Do not edit by hand.",
    "import type { ImageSource } from '@briansunter/nib-images'",
    '',
  ]
  covered.forEach((entry, index) => {
    const relative = entry.cover.slice('/site-assets/'.length)
    lines.push(`import wi${index} from '../assets/site-assets/${relative}?nib-image'`)
  })
  lines.push('')
  lines.push('export const writingImageMap: Record<string, ImageSource> = {')
  covered.forEach((entry, index) => {
    lines.push(`  ${JSON.stringify(entry.slug)}: wi${index},`)
  })
  lines.push('}')
  lines.push('')
  return lines.join('\n')
}

function buildWritingSlugsModule(writing) {
  return [
    '// Generated by scripts/import-content.mjs. Do not edit by hand.',
    `export const writingSlugs = ${JSON.stringify(writing.map((entry) => entry.slug), null, 2)} as const`,
    '',
  ].join('\n')
}

async function importPublicAssets() {
  await mkdir(OUT_PUBLIC, { recursive: true })
  await cp(SRC_PUBLIC, OUT_PUBLIC, { recursive: true, force: true })
  console.log('public: all static assets copied')
}

async function importTweetCache() {
  const source = path.join(SOURCE, '.cache/tweet-cache.json')
  const target = path.join(REPLICA, 'src/data/tweet-cache.json')
  if (!(await exists(source))) {
    throw new Error(`Canonical tweet cache not found: ${source}`)
  }
  await mkdir(path.dirname(target), { recursive: true })
  await copyFile(source, target)
  console.log('tweets: canonical cache copied')
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

function htmlAttributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)=(?:"([^"]*)"|'([^']*)')/g)]
      .map((match) => [match[1].toLowerCase(), decodeHtml(match[2] ?? match[3] ?? '')]),
  )
}

function htmlText(value = '') {
  return decodeHtml(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function sourceRouteFromMarkdown(file) {
  const relative = path.relative(SRC_DIST, file).split(path.sep).join('/')
  const withoutExtension = relative.replace(/\.md$/, '')
  if (withoutExtension === 'index') return '/'
  return `/${withoutExtension.replace(/\/index$/, '')}`
}

function sourceHtmlFile(route) {
  return route === '/'
    ? path.join(SRC_DIST, 'index.html')
    : path.join(SRC_DIST, `${route.slice(1)}.html`)
}

function sourceHeadRecord(html) {
  const title = htmlText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1])
  const metas = []
  let description = ''
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = htmlAttributes(tag)
    const attribute = attributes.property ? 'property' : attributes.name ? 'name' : null
    const key = attribute ? attributes[attribute] : null
    if (!attribute || !key) continue
    if (key === 'description') {
      description = attributes.content ?? ''
      continue
    }
    if (
      key === 'viewport'
      || key === 'theme-color'
      || key === 'generator'
      || key === 'astro-view-transitions-enabled'
      || key === 'astro-view-transitions-fallback'
    ) continue
    metas.push({ attribute, key, content: attributes.content ?? '' })
  }

  let canonical = ''
  let markdownAlternate = ''
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attributes = htmlAttributes(tag)
    if (attributes.rel === 'canonical') canonical = attributes.href ?? ''
    if (attributes.rel === 'alternate' && attributes.type === 'text/markdown') {
      markdownAlternate = attributes.href ?? ''
    }
  }

  const structuredData = [...html.matchAll(
    /<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi,
  )].map((match) => match[1].trim())

  return { title, description, canonical, markdownAlternate, metas, structuredData }
}

async function importBuiltParityArtifacts() {
  if (!(await exists(SRC_DIST))) {
    throw new Error(`Source build not found at ${SRC_DIST}. Run the personal-site build before importing exact parity artifacts.`)
  }

  const sourceFiles = await filesUnder(SRC_DIST)
  const markdownFiles = sourceFiles.filter((file) => file.endsWith('.md'))
  const sourceHead = {}
  for (const markdownFile of markdownFiles) {
    const route = sourceRouteFromMarkdown(markdownFile)
    const htmlFile = sourceHtmlFile(route)
    if (!(await exists(htmlFile))) throw new Error(`Missing source HTML for ${route}: ${htmlFile}`)
    const relative = path.relative(SRC_DIST, markdownFile)
    const target = path.join(OUT_PUBLIC, relative)
    await mkdir(path.dirname(target), { recursive: true })
    await copyFile(markdownFile, target)
    sourceHead[route] = sourceHeadRecord(await readFile(htmlFile, 'utf8'))
  }

  const sourceOg = path.join(SRC_DIST, 'og')
  const targetOg = path.join(OUT_PUBLIC, 'og')
  await rm(targetOg, { recursive: true, force: true })
  if (await exists(sourceOg)) await cp(sourceOg, targetOg, { recursive: true, force: true })

  const module = [
    '// Generated by scripts/import-content.mjs from the canonical source build. Do not edit.',
    'export interface SourceHeadRecord {',
    '  title: string',
    '  description: string',
    '  canonical: string',
    '  markdownAlternate: string',
    "  metas: Array<{ attribute: 'name' | 'property'; key: string; content: string }>",
    '  structuredData: string[]',
    '}',
    '',
    `export const sourceHead: Record<string, SourceHeadRecord> = ${JSON.stringify(sourceHead, null, 2)}`,
    '',
  ].join('\n')
  await mkdir(path.join(REPLICA, 'src/data'), { recursive: true })
  await writeFile(path.join(REPLICA, 'src/data/source-head.ts'), module)
  console.log(`parity artifacts: ${markdownFiles.length} Markdown alternates and ${Object.keys(sourceHead).length} source head records`)
}

async function importVideos() {
  if (await exists(SRC_VIDEOS)) {
    await cp(SRC_VIDEOS, OUT_VIDEOS, { recursive: true, force: true })
    console.log('videos: static video assets copied')
  }
}

async function importImageCatalog() {
  await cp(SRC_IMAGES, OUT_ASSETS, { recursive: true, force: true })
  console.log('images: complete source catalog copied')
}

function llmsLine(title, url, description) {
  const clean = String(description ?? '').replace(/\s+/g, ' ').trim()
  return clean ? `- [${title}](${url}): ${clean}` : `- [${title}](${url})`
}

async function writeLlms(writing, projects, recipes) {
  const origin = (process.env.PERSONAL_SITE_ORIGIN || 'https://briansunter.com').replace(/\/$/, '')
  const lines = [
    '# Brian Sunter',
    '',
    '> Software engineer, entrepreneur, and AI enthusiast.',
    '',
    '## Writing',
    '',
    ...writing.map((entry) => llmsLine(entry.title, `${origin}/${entry.slug}`, entry.description)),
    '',
    '## Projects',
    '',
    ...projects.map((entry) => llmsLine(entry.title, `${origin}/projects/${entry.slug}`, entry.description)),
    '',
    '## Recipes',
    '',
    ...recipes.map((entry) => llmsLine(entry.metadata.title, `${origin}/recipes/${entry.slug}`, entry.metadata.description)),
    '',
  ]
  await mkdir(path.join(REPLICA, 'public'), { recursive: true })
  await writeFile(path.join(REPLICA, 'public/llms.txt'), `${lines.join('\n').trimEnd()}\n`)
}

async function main() {
  if (!(await exists(SOURCE))) {
    throw new Error(`PERSONAL_SITE_SRC not found: ${SOURCE}`)
  }
  const commit = sourceCommit()
  // Clean only generated content roots. Hand-written route pages (about,
  // 404, projects index, etc.) are owned by this repo and left in place.
  await rm(path.join(OUT_CONTENT), { recursive: true, force: true })
  await rm(path.join(OUT_ASSETS), { recursive: true, force: true })
  await rm(path.join(OUT_VIDEOS), { recursive: true, force: true })
  await rm(path.join(OUT_CURATED), { recursive: true, force: true })
  await rm(path.join(OUT_PAGES, '_data'), { recursive: true, force: true })
  await rm(path.join(REPLICA, 'public/site-assets'), { recursive: true, force: true })

  // Remove stale writing page.md directories by source slug so reruns do not
  // leave dead routes behind.
  if (await exists(SRC_PAGES)) {
    const pageFiles = (await readDir(SRC_PAGES)).filter((f) => f.endsWith('.md'))
    for (const file of pageFiles) {
      const source = await readFile(path.join(SRC_PAGES, file), 'utf8')
      const { data } = parseFrontmatter(source)
      const slug = cleanSlug(data.slug ?? file.replace(/\.md$/, ''))
      await rm(path.join(OUT_PAGES, slug), { recursive: true, force: true })
    }
  }
  await mkdir(OUT_PAGES, { recursive: true })

  const writing = await importWriting()
  const projects = await importProjects()
  await importRecipes()
  let recipes
  try {
    recipes = JSON.parse(await readFile(path.join(OUT_CONTENT, 'recipes.json'), 'utf8'))
  } catch (error) {
    throw new Error(`Failed to parse generated recipes.json: ${error instanceof Error ? error.message : error}`)
  }
  const galleryImagePaths = await importGalleries()
  await importGalleryRuntime()
  await buildTags(writing)
  await importPublicAssets()
  await importTweetCache()
  await importBuiltParityArtifacts()
  await importImageCatalog()
  await importVideos()
  await writeLlms(writing, projects, recipes)
  await mkdir(path.join(REPLICA, 'src/data'), { recursive: true })
  await writeFile(path.join(REPLICA, 'src/data/images.ts'), await buildImagesModule(projects))
  await writeFile(path.join(REPLICA, 'src/data/writing-images.ts'), await buildWritingImagesModule(writing))
  await writeFile(path.join(REPLICA, 'src/data/writing-slugs.ts'), buildWritingSlugsModule(writing))
  await writeFile(path.join(REPLICA, 'src/data/gallery-images.ts'), await buildGalleryImagesModule(galleryImagePaths))
  await writeSourceProvenance(commit)
  console.log(`gallery images: ${galleryImagePaths.size} sources indexed`)
  console.log('import complete')
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
