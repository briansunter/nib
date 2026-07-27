import { siteHref } from '@briansunter/nib'

function tagToSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stripPageSuffix(tag: string): string {
  return tag.replace(/[/_-]?page$/i, '').trim() || tag
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

/** Shared date + tags footer for post cards. Mirrors PostCardMeta.astro. */
export function PostCardMeta({
  date,
  tags,
  className,
}: {
  date?: Date
  tags: string[]
  className?: string
}) {
  if (!date && tags.length === 0) return null
  return (
    <div className={['meta flex flex-wrap items-center gap-x-4 gap-y-2', className].filter(Boolean).join(' ')}>
      {date && <time dateTime={date.toISOString()} className="text-sm text-ink-muted">{formatDate(date)}</time>}
      {tags.length > 0 && (
        <div className="tags-container flex flex-wrap gap-3">
          {tags.map((tag) => (
            <a
              key={tag}
              href={siteHref(`/tags/${tagToSlug(tag)}`)}
              className="tag-link tag-mono relative z-10 text-xs text-ink-secondary transition-colors hover:text-ink"
            >
              {stripPageSuffix(tag)}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
