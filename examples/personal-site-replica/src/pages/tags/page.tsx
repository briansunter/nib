import type { PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'

export const meta = {
  title: 'Tags',
  description: 'Browse all topics used across the writing, projects, and recipes.',
}

export default function TagsPage({ collections }: PageProps<typeof config>) {
  const counts = new Map<string, { display: string; count: number }>()
  function bump(tag: string) {
    const key = tag.toLowerCase().replace(/\s+/g, '-')
    const existing = counts.get(key)
    if (existing) existing.count += 1
    else counts.set(key, { display: tag, count: 1 })
  }
  for (const entry of collections.writing) for (const tag of entry.data.tags) bump(tag)
  for (const entry of collections.projects) for (const tag of entry.data.tags) bump(tag)
  for (const entry of collections.recipes) for (const tag of entry.data.metadata.tags) bump(tag)
  const tags = [...counts.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))

  return (
    <div className="content-column tag-page">
      <p className="eyebrow">Browse the archive</p>
      <h1>Tags</h1>
      <p className="lead">{tags.length} topics across writing, projects, and recipes.</p>
      <div className="tag-cloud">
        {tags.map((tag) => (
          <a className="tag tag--pill" href={`/tags/${tag.key}`} key={tag.key}>
            {tag.display} <span>{tag.count}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
