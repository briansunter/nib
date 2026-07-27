import { defineIsland } from '@briansunter/nib'
import { useEffect, useState } from 'react'

interface TagOption { value: string; count: number }

function RecipeControlsComponent({ categories, tags, listId }: { categories: TagOption[]; tags: TagOption[]; listId: string }) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [visible, setVisible] = useState<number | null>(null)

  useEffect(() => {
    const list = document.getElementById(listId)
    if (!list) return
    const normalized = query.trim().toLowerCase()
    let count = 0
    for (const item of [...list.querySelectorAll<HTMLElement>('li[data-recipe]')]) {
      const matchesQuery = normalized === '' || (item.dataset.search ?? '').includes(normalized)
      const matchesTag = tag === '' || (item.dataset.tags ?? '').split(',').includes(tag)
      item.hidden = !(matchesQuery && matchesTag)
      if (!item.hidden) count += 1
    }
    setVisible(count)
  }, [listId, query, tag])

  const clearFilters = () => {
    setQuery('')
    setTag('')
  }

  return (
    <div className="recipe-filter">
      <div className="recipe-filter__controls">
        <label className="recipe-filter__search">
          <span className="sr-only">Search recipes</span>
          <input id="recipe-search" type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search recipes…" />
        </label>
      </div>
      <div className="recipe-filter__tags" role="group" aria-label="Filter recipes by tag">
        {categories.map((option) => <button type="button" className={`tag tag--pill recipe-filter__category ${tag === option.value ? 'is-active' : ''}`} aria-pressed={tag === option.value} onClick={() => setTag((current) => current === option.value ? '' : option.value)} key={option.value}>{option.value} <span>{option.count}</span></button>)}
        {tags.map((option) => <button type="button" className={`tag tag--pill ${tag === option.value ? 'is-active' : ''}`} aria-pressed={tag === option.value} onClick={() => setTag((current) => current === option.value ? '' : option.value)} key={option.value}>{option.value} <span>{option.count}</span></button>)}
        {(query || tag) && <button type="button" className="recipe-filter__clear" onClick={clearFilters}>Clear</button>}
      </div>
      <p className="search-status" aria-live="polite">{visible === null ? 'Filtering…' : `${visible} recipe${visible === 1 ? '' : 's'}`}</p>
    </div>
  )
}

export default defineIsland('recipe-filter', RecipeControlsComponent)
