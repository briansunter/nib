import { type PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'
import { PostListItem } from '../../components/BlogList'
import { PageHero } from '../../components/PageHero'
import { groupPostsByYearMonth, titledPages } from '../../lib/content-queries'

export const meta = {
  title: 'Archive',
  description: 'A chronological collection of articles, notes, and thoughts.',
}

export default function ArchivePage({ collections }: PageProps<typeof config>) {
  const posts = titledPages(collections.writing.map((entry) => entry.data))
  const grouped = groupPostsByYearMonth(posts)

  return (
    <div className="py-16 sm:py-20" data-pagefind-ignore>
      <PageHero title="Archive">
        A chronological collection of articles, notes, and thoughts.
        <span className="mt-2 block font-sans text-base md:text-lg">
          <span className="font-semibold text-ink tabular-nums">{posts.length}</span> posts.
        </span>
      </PageHero>
      <div className="space-y-14">
          {grouped.map(({ year, months }) => (
            <section key={year}>
              <div className="mb-8 flex items-center gap-4 sm:mb-12 sm:gap-6">
                <h2 className="text-display font-bold tracking-tight text-ink tabular-nums lg:text-h1">{year}</h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-10">
                {months.map(({ month, posts: monthPosts }) => (
                  <div key={month}>
                    <h3 className="mb-8 text-h1 font-semibold tracking-tight text-ink-secondary sm:mb-10 lg:text-h2">{month}</h3>
                    <div className="post-list flex flex-col">
                      {monthPosts.map((post) => (
                        <PostListItem
                          post={post}
                          analyticsSource="archive"
                          headingTag="h4"
                          key={post.slug}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  )
}
