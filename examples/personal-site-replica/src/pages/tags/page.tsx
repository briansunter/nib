import { type PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'
import { tagSearchHref } from '../../data/tag-links'

export const meta = {
  title: 'Tags',
  description: 'Topics used across the writing and project collections.',
}

export default function TagsPage({ collections }: PageProps<typeof config>) {
  const counts = new Map<string, number>()
  for (const entry of [...collections.posts, ...collections.projects]) {
    for (const tag of entry.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  return (
    <div className="content-column tag-page">
      <p className="eyebrow">Browse the archive</p>
      <h1>Tags</h1>
      <p className="lead">Search the writing and project archive by topic.</p>
      <div className="tag-cloud">
        {tags.map(([tag, count]) => <a className="tag tag--pill" href={tagSearchHref(tag)} key={tag}>{tag} <span>{count}</span></a>)}
      </div>
    </div>
  )
}
