import { siteHref, type PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'
import { SectionHeading } from '../../components/SectionHeading'

export const meta = {
  title: 'Archive',
  description: 'A chronological collection of articles, notes, and thoughts.',
}

interface ArchiveEntry {
  slug: string
  title: string
  description: string
  date: Date
  tags: string[]
  cover: string | null
}

function groupByYearMonth(entries: readonly ArchiveEntry[]) {
  const sorted = [...entries].sort((a, b) => b.date.valueOf() - a.date.valueOf())
  const years = new Map<string, Map<string, ArchiveEntry[]>>()
  const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long' })
  for (const entry of sorted) {
    const year = String(entry.date.getFullYear())
    const month = monthFormat.format(entry.date)
    const yearMap = years.get(year) ?? new Map()
    const list = yearMap.get(month) ?? []
    list.push(entry)
    yearMap.set(month, list)
    years.set(year, yearMap)
  }
  return [...years.entries()].map(([year, months]) => ({
    year,
    months: [...months.entries()].map(([month, posts]) => ({ month, posts })),
  }))
}

export default function ArchivePage({ collections }: PageProps<typeof config>) {
  const entries: ArchiveEntry[] = collections.writing.map((entry) => ({
    slug: entry.data.slug,
    title: entry.data.title,
    description: entry.data.description,
    date: entry.data.date,
    tags: entry.data.tags,
    cover: entry.data.cover,
  }))
  const grouped = groupByYearMonth(entries)

  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">Archive</p>
        <h1>Archive</h1>
        <p className="lead">A chronological collection of articles, notes, and thoughts.</p>
        <p className="project-count">{entries.length} posts</p>
      </header>
      <section className="content-column">
        <SectionHeading title={`${entries.length} posts`} href="/search" linkLabel="Search" />
        <div className="archive">
          {grouped.map(({ year, months }) => (
            <section key={year} className="archive-year">
              <div className="archive-year__heading">
                <h2>{year}</h2>
                <div className="archive-rule" />
              </div>
              {months.map(({ month, posts }) => (
                <div key={month} className="archive-month">
                  <h3>{month}</h3>
                  <div className="post-list">
                    {posts.map((post) => (
                      <article className="post-card" key={post.slug}>
                        <a className="post-card__link" href={siteHref(`/${post.slug}`)}>
                          {post.cover && (
                            <img
                              className="archive-thumb"
                              src={siteHref(post.cover)}
                              alt=""
                              width={256}
                              height={256}
                              loading="lazy"
                              decoding="async"
                              data-nib-width="256"
                              data-nib-widths="96,160,256"
                              sizes="(min-width: 640px) 128px, 80px"
                            />
                          )}
                          <div className="post-card__body">
                            <h3>{post.title}</h3>
                            {post.description && <p>{post.description}</p>}
                            <div className="meta-row">
                              <time dateTime={post.date.toISOString()}>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(post.date)}</time>
                              {post.tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                            </div>
                          </div>
                        </a>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
        <p className="small-note"><a href={siteHref('/index.xml')}>Subscribe via RSS →</a></p>
      </section>
    </div>
  )
}
