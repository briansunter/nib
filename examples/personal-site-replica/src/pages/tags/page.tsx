import type { PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'
import { PageHero } from '../../components/PageHero'
import { tagCounts } from '../../lib/content-queries'

export const meta = {
  title: 'Tags',
  description: 'Browse all topics and tags',
}

export default function TagsPage({ collections }: PageProps<typeof config>) {
  const tags = tagCounts(collections.writing.map((entry) => entry.data))
  const tierClass = (count: number) => count >= 10
    ? 'text-base font-medium'
    : count >= 3 ? 'text-sm' : 'text-xs'

  return (
    <div className="py-16 sm:py-20" data-pagefind-ignore>
      <PageHero title="Tags">
        Every topic on the site, from programming to cooking.
        <span className="mt-2 block font-sans text-base md:text-lg">
          <span className="font-semibold text-ink tabular-nums">{tags.length}</span> topics.
        </span>
      </PageHero>
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {tags.map(([slug, tag]) => (
          <a
            className={[
              'tag-item tag-mono focus-accent inline-flex items-baseline gap-1.5 text-ink-secondary transition-colors hover:text-ink',
              tierClass(tag.count),
            ].join(' ')}
            href={`/tags/${slug}`}
            key={slug}
          >
            <span>{tag.displayName}</span>
            <span className="text-xs text-ink-muted tabular-nums">{tag.count}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
