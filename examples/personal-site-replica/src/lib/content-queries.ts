import type { Writing } from '../content'

const META_TAGS = new Set(['blog', 'newsletter'])

export function stripPageSuffix(tag: string): string {
  return tag.replace(/-page$/i, '')
}

export function normalizePageTag(tag: string): string {
  return stripPageSuffix(tag).toLowerCase().trim()
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s/\\_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function tagToSlug(tag: string): string {
  return slugify(stripPageSuffix(tag))
}

export function isBlogOrNewsletter(entry: Writing): boolean {
  return entry.tags.some((tag) => META_TAGS.has(normalizePageTag(tag)))
}

export function visiblePageTags(entry: Writing, limit = 3): string[] {
  return entry.tags
    .filter((tag) => !META_TAGS.has(normalizePageTag(tag)))
    .slice(0, limit)
}

/**
 * Astro's content collection is path ordered before the reference site's
 * stable date sort. The replica's manifest has a different insertion order,
 * so use the canonical slug as the explicit tie-breaker.
 */
export function comparePageOrder(a: Writing, b: Writing): number {
  const dateOrder = b.date.valueOf() - a.date.valueOf()
  if (dateOrder !== 0) return dateOrder
  if (a.slug < b.slug) return -1
  if (a.slug > b.slug) return 1
  return 0
}

export function titledPages(entries: readonly Writing[]): Writing[] {
  return [...entries]
    .sort(comparePageOrder)
    .filter((entry) => Boolean(entry.title))
}

export function blogPosts(entries: readonly Writing[]): Writing[] {
  return titledPages(entries).filter(isBlogOrNewsletter)
}

export function tagCounts(entries: readonly Writing[]) {
  const counts = new Map<string, { displayName: string; count: number }>()
  for (const entry of entries) {
    for (const tag of entry.tags) {
      const displayName = normalizePageTag(tag)
      if (!displayName || META_TAGS.has(displayName)) continue
      const slug = tagToSlug(tag)
      const existing = counts.get(slug)
      if (existing) existing.count += 1
      else counts.set(slug, { displayName, count: 1 })
    }
  }
  return [...counts.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count
    return a[1].displayName.localeCompare(b[1].displayName)
  })
}

export function groupPostsByYearMonth(entries: readonly Writing[]) {
  const monthOrder = [
    'December', 'November', 'October', 'September', 'August', 'July',
    'June', 'May', 'April', 'March', 'February', 'January',
  ]
  const grouped = new Map<string, Map<string, Writing[]>>()
  for (const post of titledPages(entries)) {
    const year = String(post.date.getUTCFullYear())
    const month = post.date.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'long',
    })
    const months = grouped.get(year) ?? new Map<string, Writing[]>()
    const posts = months.get(month) ?? []
    posts.push(post)
    months.set(month, posts)
    grouped.set(year, months)
  }
  return [...grouped.entries()]
    .sort((a, b) => Number.parseInt(b[0], 10) - Number.parseInt(a[0], 10))
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort((a, b) => monthOrder.indexOf(a[0]) - monthOrder.indexOf(b[0]))
        .map(([month, posts]) => ({ month, posts })),
    }))
}

export function adjacentPages(entries: readonly Writing[], currentSlug: string) {
  const posts = titledPages(entries)
  const index = posts.findIndex((entry) => entry.slug === currentSlug)
  if (index === -1) return {}
  return { newer: posts[index - 1], older: posts[index + 1] }
}

function comparableTags(entry: Writing): Set<string> {
  return new Set(
    entry.tags
      .map(normalizePageTag)
      .filter((tag) => tag && !META_TAGS.has(tag)),
  )
}

export function relatedPages(entries: readonly Writing[], current: Writing, limit = 3): Writing[] {
  const currentTags = comparableTags(current)
  const candidates = titledPages(entries).filter((entry) => entry.slug !== current.slug)
  if (currentTags.size === 0) return candidates.slice(0, limit)
  const ranked = candidates
    .map((entry) => ({
      entry,
      score: [...comparableTags(entry)].filter((tag) => currentTags.has(tag)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || comparePageOrder(a.entry, b.entry))
  return (ranked.length ? ranked.map(({ entry }) => entry) : candidates).slice(0, limit)
}
