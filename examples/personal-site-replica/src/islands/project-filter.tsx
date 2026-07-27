import { useEffect, useState } from 'react'
import { defineIsland } from '@briansunter/nib'

interface TagOption { value: string; label: string; count: number }

function ProjectFilter({ tags, listId }: { tags: TagOption[]; listId: string }) {
  const [selected, setSelected] = useState('')
  const [visible, setVisible] = useState<number | null>(null)

  useEffect(() => {
    const root = document.getElementById(listId)
    if (!root) return
    const cards = [...root.querySelectorAll<HTMLElement>('[data-project-card]')]
    const count = cards.reduce((total, card) => {
      const matches = selected === '' || (card.dataset.projectTags ?? '').split(',').includes(selected)
      card.hidden = !matches
      return total + (matches ? 1 : 0)
    }, 0)
    setVisible(count)
  }, [listId, selected])

  return (
    <div className="project-filters" data-project-filters>
      <div className="project-filter-heading">
        <p className="eyebrow">Browse by focus</p>
        <p className="project-filter-hint" aria-live="polite">{visible === null ? `${tags[0]?.count ?? 0} projects` : `${visible} projects`}</p>
      </div>
      <div className="project-filter-rail" role="group" aria-label="Filter projects">
        <button type="button" className={`tag tag--pill project-filter-chip ${selected === '' ? 'is-active' : ''}`} value="" aria-pressed={selected === ''} onClick={() => setSelected('')}>All <span>{tags[0]?.count ?? 0}</span></button>
        {tags.slice(1).map((tag) => (
          <button type="button" className={`tag tag--pill project-filter-chip ${selected === tag.value ? 'is-active' : ''}`} value={tag.value} aria-pressed={selected === tag.value} onClick={() => setSelected(tag.value)} key={tag.value}>{tag.label} <span>{tag.count}</span></button>
        ))}
      </div>
    </div>
  )
}

export default defineIsland('project-filter', ProjectFilter)
