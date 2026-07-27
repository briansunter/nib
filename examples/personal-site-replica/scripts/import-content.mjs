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
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { marked } from 'marked'

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

const OUT_PAGES = path.join(REPLICA, 'src/pages')
const OUT_CONTENT = path.join(REPLICA, 'src/content')
const OUT_ASSETS = path.join(REPLICA, 'src/assets/site-assets')
const OUT_VIDEOS = path.join(REPLICA, 'public/videos')
const OUT_CURATED = path.join(REPLICA, 'src/assets/images/curated')

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

function rewriteIframeEmbeds(body) {
  return body.replace(/<iframe\b([^>]*)><\/iframe>/gi, (_full, attributes) => {
    const source = attributes.match(/\bsrc=["']([^"']+)["']/i)?.[1]
    if (!source) return ''
    const escaped = source.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    return `<iframe src="${escaped}" title="Embedded media"></iframe>`
  })
}

function rewriteWritingMarkdown(body, writingSlugs) {
  let out = rewriteIframeEmbeds(rewriteVideoEmbeds(body))
  // Obsidian embeds: ![[File.png]] or ![[File.png|alt]]
  out = out.replace(/!\[\[([^\]]+)\]\]/g, (_full, inner) => {
    const [file, alt] = inner.split('|')
    const target = normalizeImageRef(file.trim())
    return `![${alt ?? ''}](/site-assets/${target})`
  })
  // Wikilinks: [[slug]] or [[slug|Label]]
  out = out.replace(/\[\[([^\]]+)\]\]/g, (_full, inner) => {
    const [rawSlug, label] = inner.split('|')
    const slug = cleanSlug(rawSlug)
    if (writingSlugs.has(slug)) {
      const text = label ? label.trim() : slug
      return `[${text}](/${slug})`
    }
    return label ? label.trim() : rawSlug.trim()
  })
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
  const slugSet = new Set()
  for (const file of files) {
    const source = await readFile(path.join(SRC_PAGES, file), 'utf8')
    const { data, body } = parseFrontmatter(source)
    const slug = cleanSlug(data.slug ?? file.replace(/\.md$/, ''))
    slugSet.add(slug)
    entries.push({ file, data, body, slug })
  }
  // Second pass: rewrite bodies now that the full slug set is known.
  for (const entry of entries) {
    const { slug, data, body } = entry
    const title = (data.pageTitle || data.title || slug).toString().trim()
    const description = (data.description || '').toString().trim()
    const date = data.date ? new Date(data.date).toISOString() : null
    const tags = asArray(data.tags).map(String)
    const coverRel = data.coverImage ? normalizeImageRef(String(data.coverImage)) : null
    const cover = coverRel ? await copyImage(coverRel) : null
    const rewritten = rewriteWritingMarkdown(body, slugSet)
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
      tags.length ? `tags:\n${tags.map((t) => `  - ${JSON.stringify(t)}`).join('\n')}` : null,
      'layout: article',
      '---',
      '',
    ].filter(Boolean).join('\n')
    const dir = path.join(OUT_PAGES, slug)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'page.md'), `${frontmatter}${rewritten.trimEnd()}\n`)
    entries[entries.indexOf(entry)] = { slug, title, description, date, tags, cover }
  }
  // Sort newest first for the archive/RSS.
  entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  await mkdir(OUT_CONTENT, { recursive: true })
  await writeFile(
    path.join(OUT_CONTENT, 'writing.json'),
    `${JSON.stringify(entries, null, 2)}\n`,
  )
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
    const bodyHtml = await marked.parse(bodyMarkdown)
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
      bodyHtml,
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

// Minimal Cooklang parser sufficient for the recipes in this collection.
function parseCooklang(source) {
  const { data, body } = parseFrontmatter(source)
  const lines = body.split(/\r?\n/)
  const sections = [{ title: '', steps: [] }]
  const ingredients = []
  const cookware = []

  function humanizeToken(text) {
    return text
      .replace(/@([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*)\s*\{([^%}]*)(?:%([^}]*))?\}(\([^)]*\))?/g, (_m, name, qty, unit, suf) => {
        const quantity = qty.trim()
        const u = unit ? unit.trim() : ''
        const unitText = u ? ` ${u}` : ''
        const suffixText = suf ?? ''
        return `${quantity}${unitText} ${name}${suffixText}`.trim()
      })
      .replace(/@([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*)/g, (_m, name) => name)
      .replace(/#([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*)\s*\{([^}]*)\}/g, (_m, name) => name)
      .replace(/#([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*)/g, (_m, name) => name)
      .replace(/~([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*)?\s*\{([^%}]*)(?:%([^}]*))?\}/g, (_m, name, qty, unit) => {
        const quantity = qty.trim()
        const u = unit ? unit.trim() : ''
        const unitText = u ? ` ${u}` : ''
        const labelText = name ? ` ${name}` : ''
        return `${quantity}${unitText}${labelText}`.trim()
      })
  }

  function extractTokens(text) {
    const ingRe = /@([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*)\s*\{([^%}]*)(?:%([^}]*))?\}/g
    const ingReBare = /@([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*)/g
    const cookRe = /#([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*)\s*\{([^}]*)\}/g
    const cookReBare = /#([A-Za-z][\w'-]*(?:\s+[A-Za-z][\w'-]*)*)/g
    const ingSeen = new Set()
    function addIngredient(name, qtyRaw, unit) {
      const key = name.toLowerCase()
      if (ingSeen.has(key)) return
      ingSeen.add(key)
      const numeric = parseFloat((qtyRaw || '').replace(/[^0-9./-]/g, ''))
      ingredients.push({
        name,
        ...(qtyRaw && qtyRaw.trim() ? { quantity: Number.isFinite(numeric) ? numeric : qtyRaw.trim() } : {}),
        ...(unit && unit.trim() ? { unit: unit.trim() } : {}),
        ...(qtyRaw && qtyRaw.trim() && !Number.isFinite(numeric) ? { raw: qtyRaw.trim() } : {}),
      })
    }
    for (let m = ingRe.exec(text); m !== null; m = ingRe.exec(text)) {
      addIngredient(m[1].trim(), m[2], m[3])
    }
    for (let m = ingReBare.exec(text); m !== null; m = ingReBare.exec(text)) {
      addIngredient(m[1].trim(), '', '')
    }
    const cookSeen = new Set()
    for (let m = cookRe.exec(text); m !== null; m = cookRe.exec(text)) {
      const name = m[1].trim()
      if (!cookSeen.has(name.toLowerCase())) { cookSeen.add(name.toLowerCase()); cookware.push(name) }
    }
    for (let m = cookReBare.exec(text); m !== null; m = cookReBare.exec(text)) {
      const name = m[1].trim()
      if (!cookSeen.has(name.toLowerCase())) { cookSeen.add(name.toLowerCase()); cookware.push(name) }
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^==.*==$/.test(line.trim())) {
      const title = line.trim().replace(/^==+|==+$/g, '').trim()
      sections.push({ title, steps: [] })
      continue
    }
    if (/^--.*--$/.test(line.trim())) continue
    extractTokens(line)
    const human = humanizeToken(line)
    sections[sections.length - 1].steps.push(human)
  }

  return { metadata: data, sections, ingredients, cookware, sourceText: body }
}

function normalizeRecipeMetadata(meta, slug) {
  const metadata = {
    ...meta,
    title: String(meta.title || slug),
    description: String(meta.description || ''),
    tags: asArray(meta.tags).map(String),
  }
  if (meta.servings != null && meta.servings !== '') {
    const servings = Number(meta.servings)
    if (Number.isFinite(servings)) metadata.servings = servings
  }

  const aliases = {
    prepTime: ['prepTime', 'prep time', 'prep-time'],
    cookTime: ['cookTime', 'cook time', 'cook-time'],
    totalTime: ['totalTime', 'total time', 'time', 'time required'],
    longDescription: ['longDescription', 'long_description'],
  }
  for (const [canonical, keys] of Object.entries(aliases)) {
    const value = keys.map((key) => meta[key]).find((candidate) => candidate != null && candidate !== '')
    if (value != null) metadata[canonical] = String(value)
  }
  return metadata
}

async function importRecipes() {
  const files = (await readDir(SRC_RECIPES)).filter((f) => f.endsWith('.cook'))
  const recipes = []
  for (const file of files) {
    const source = await readFile(path.join(SRC_RECIPES, file), 'utf8')
    const slug = file.replace(/\.cook$/, '')
    const parsed = parseCooklang(source)
    const meta = parsed.metadata || {}
    recipes.push({
      slug,
      metadata: normalizeRecipeMetadata(meta, slug),
      ingredients: parsed.ingredients,
      cookware: parsed.cookware,
      sections: parsed.sections,
      sourceText: parsed.sourceText,
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
        date: item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
        tags: asArray(item.tags).map(String),
        image: img,
      })
    }
    art.push({
      name: data.name,
      description: data.description || '',
      default: Boolean(data.default),
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
      name: data.name,
      description: data.description || '',
      location: data.location || '',
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
      acquiredAt: pin.acquired_at || '',
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

async function buildTags(writing, projects, recipes) {
  const map = new Map()
  function add(tag, entry) {
    const key = String(tag).toLowerCase().replace(/\s+/g, '-')
    if (!map.has(key)) map.set(key, { tag: key, display: String(tag), entries: [] })
    map.get(key).entries.push(entry)
  }
  for (const w of writing) {
    for (const t of w.tags) add(t, { kind: 'Writing', title: w.title, href: `/${w.slug}`, description: w.description })
  }
  for (const p of projects) {
    for (const t of p.tags) add(t, { kind: 'Project', title: p.title, href: `/projects/${p.slug}`, description: p.description })
  }
  for (const r of recipes) {
    for (const t of r.metadata.tags) add(t, { kind: 'Recipe', title: r.metadata.title, href: `/recipes/${r.slug}`, description: r.metadata.description })
  }
  const tags = [...map.values()]
    .map((t) => ({ ...t, count: t.entries.length }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  await mkdir(OUT_CONTENT, { recursive: true })
  await writeFile(path.join(OUT_CONTENT, 'tags.json'), `${JSON.stringify(tags, null, 2)}\n`)
  console.log(`tags: ${tags.length}`)
  return tags
}

async function buildImagesModule(projects) {
  const featured = projects.filter((p) => p.featured && p.coverFile)
  const lines = [
    "import type { ImageSource } from '@briansunter/nib-images'",
    "import avatar from '../assets/avatar.jpg?nib-image'",
    '',
  ]
  for (const p of featured) {
    const varName = `${p.slug.replace(/[^A-Za-z0-9]/g, '_')}Cover`
    lines.push(`import ${varName} from '${p.coverFile}?nib-image'`)
  }
  lines.push('')
  lines.push('export const imageMap: Record<string, ImageSource> = {')
  lines.push('  avatar,')
  for (const p of featured) {
    const varName = `${p.slug.replace(/[^A-Za-z0-9]/g, '_')}Cover`
    lines.push(`  '${p.slug}': ${varName},`)
  }
  lines.push('}')
  lines.push('')
  lines.push(`export const featuredProjectSlugs = ${JSON.stringify(featured.map((p) => p.slug))}`)
  lines.push('')
  lines.push('export { avatar }')
  lines.push('')
  return lines.join('\n')
}

async function importPublicAssets() {
  const target = path.join(REPLICA, 'public')
  await mkdir(target, { recursive: true })
  await cp(SRC_PUBLIC, target, { recursive: true, force: true })
  console.log('public: all static assets copied')
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
  await buildTags(writing, projects, recipes)
  await importPublicAssets()
  await importImageCatalog()
  await importVideos()
  await writeLlms(writing, projects, recipes)
  await mkdir(path.join(REPLICA, 'src/data'), { recursive: true })
  await writeFile(path.join(REPLICA, 'src/data/images.ts'), await buildImagesModule(projects))
  await writeFile(path.join(REPLICA, 'src/data/gallery-images.ts'), await buildGalleryImagesModule(galleryImagePaths))
  console.log(`gallery images: ${galleryImagePaths.size} sources indexed`)
  console.log('import complete')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
