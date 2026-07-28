/**
 * Match the reference site's `FormattedDate.astro` output.
 *
 * The source deliberately leaves the time zone implicit, so date-only UTC
 * values are displayed in the build's local time zone.
 */
export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-us', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Match the uppercase date used by the reference article layout. */
export function formatArticleDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).toUpperCase()
}
