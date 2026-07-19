import { siteHref } from '@briansunter/nib'

export function tagSearchHref(tag: string): string {
  return `${siteHref('/search')}?tag=${encodeURIComponent(tag.toLowerCase())}`
}
