import { defineIsland } from '@briansunter/nib'
import { useEffect, useMemo, useState } from 'react'

export interface SearchEntry {
  title: string
  description: string
  href: string
  kind: string
  tags: string[]
}

function SearchComponent({ entries }: { entries: SearchEntry[] }) {
  const [query, setQuery] = useState('')
  useEffect(() => {
    const tag = new URLSearchParams(window.location.search).get('tag')
    if (tag) setQuery(tag)
  }, [])
  const normalized = query.trim().toLowerCase()
  const results = useMemo(() => (
    normalized === ''
      ? entries
      : entries.filter((entry) => `${entry.title} ${entry.description} ${entry.tags.join(' ')}`.toLowerCase().includes(normalized))
  ), [entries, normalized])

  return (
    <div className="search-tool">
      <label htmlFor="site-search">Search the replica</label>
      <input
        id="site-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Try “static” or “AI”"
      />
      <p className="search-status" aria-live="polite">{results.length} result{results.length === 1 ? '' : 's'}</p>
      <div className="search-results">
        {results.map((entry) => (
          <a href={entry.href} key={entry.href} className="search-result">
            <span className="eyebrow">{entry.kind}</span>
            <strong>{entry.title}</strong>
            <span>{entry.description}</span>
          </a>
        ))}
        {results.length === 0 && <p className="empty-state">Nothing matched that search.</p>}
      </div>
    </div>
  )
}

export default defineIsland('search', SearchComponent)
