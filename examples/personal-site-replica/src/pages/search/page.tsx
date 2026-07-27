import { type PageProps, siteHref } from '@briansunter/nib'
import type config from '../../../nib.config'
import Search from '../../islands/search'

export const meta = {
  title: 'Search | Brian Sunter',
  description: 'Search the writing, projects, and recipes on this site.',
}

export default function SearchPage({ collections }: PageProps<typeof config>) {
  const tagCounts = new Map<string, number>()
  for (const entry of collections.writing) for (const tag of entry.data.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  for (const entry of collections.projects) for (const tag of entry.data.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  const popularTopics = [...tagCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 10)
  const recentWriting = [...collections.writing].sort((left, right) => right.data.date.valueOf() - left.data.date.valueOf()).slice(0, 5)
  const entries = [
    ...collections.writing.map(({ data }) => ({
      title: data.title,
      description: data.description,
      href: siteHref(`/${data.slug}`),
      kind: 'Writing',
      tags: data.tags,
    })),
    ...collections.projects.map(({ data }) => ({
      title: data.title,
      description: data.description,
      href: siteHref(`/projects/${data.slug}`),
      kind: 'Project',
      tags: data.tags,
    })),
    ...collections.recipes.map(({ data }) => ({
      title: data.metadata.title,
      description: data.metadata.description,
      href: siteHref(`/recipes/${data.slug}`),
      kind: 'Recipe',
      tags: data.metadata.tags,
    })),
  ].slice(0, 24)

  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">Find a thread</p>
        <h1>Search</h1>
        <p className="lead">Search across the writing, projects, and recipes. The full index is a static resource; only the input and result list hydrate.</p>
      </header>
      <div className="content-column">
        <Search listId="search-list" indexUrl={siteHref('/search.json')} hydrate="load" />
        <ul className="search-results search-results--page" id="search-list" aria-label="Search results">
          {entries.map((entry, index) => (
            <li
              className="search-result"
              data-search-item
              data-order={index}
              data-title={entry.title}
              data-description={entry.description}
              data-kind={entry.kind}
              data-tags={entry.tags.join(' ')}
              data-search={`${entry.title} ${entry.description} ${entry.kind} ${entry.tags.join(' ')}`}
              key={entry.href}
            >
              <a href={entry.href}>
                <span className="eyebrow">{entry.kind}</span>
                <strong>{entry.title}</strong>
                <span>{entry.description}</span>
              </a>
            </li>
          ))}
        </ul>
        <section className="search-discovery" aria-label="Search discovery">
          <h2>Popular Topics</h2>
          <div className="search-topic-list">
            {popularTopics.map(([tag, count]) => <a href={siteHref(`/search?tag=${encodeURIComponent(tag)}`)} className="search-topic" key={tag}><span>#{tag}</span><b>{count}</b></a>)}
          </div>
          <h2>Recent Writing</h2>
          <ul className="search-recent-list">
            {recentWriting.map((entry) => <li key={entry.data.slug}><a href={siteHref(`/${entry.data.slug}`)}>{entry.data.title}</a><time dateTime={entry.data.date.toISOString()}>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(entry.data.date)}</time></li>)}
          </ul>
        </section>
      </div>
    </div>
  )
}
