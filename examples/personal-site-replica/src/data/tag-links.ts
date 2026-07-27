import { siteHref } from '@briansunter/nib'

export function tagHref(tag: string): string {
  const slug = tag.toLowerCase().replace(/\s+/g, '-')
  return siteHref(`/tags/${slug}`)
}

export function tagSearchHref(tag: string): string {
  return `${siteHref('/search')}?tag=${encodeURIComponent(tag.toLowerCase())}`
}
