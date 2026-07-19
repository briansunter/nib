import { type PageProps, siteHref } from '@briansunter/nib'
import type config from '../../../nib.config'
import Search from '../../islands/search'

export const meta = {
  title: 'Search',
  description: 'Search the writing and projects in this Nib replica.',
}

export default function SearchPage({ collections }: PageProps<typeof config>) {
  const entries = [
    ...collections.posts.map(({ data }) => ({
      title: data.title,
      description: data.description,
      href: siteHref(`/notes/${data.slug}`),
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
  ]

  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">Find a thread</p>
        <h1>Search</h1>
        <p className="lead">The real site uses a generated search index. This version keeps the index as serializable page data and hydrates only the input and result list.</p>
      </header>
      <div className="content-column">
        <Search entries={entries} hydrate="load" />
      </div>
    </div>
  )
}
