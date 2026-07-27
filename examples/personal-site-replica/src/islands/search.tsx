import { defineIsland } from '@briansunter/nib'
import { useEffect, useState } from 'react'

interface SearchItem {
  title: string
  description?: string
  href: string
  kind?: string
  tags?: string[]
  text?: string
}

function normalized(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function scoreResult(item: HTMLElement, terms: string[]): number | undefined {
  const title = normalized(item.dataset.title)
  const description = normalized(item.dataset.description)
  const kind = normalized(item.dataset.kind)
  const tags = normalized(item.dataset.tags)
  const text = normalized(item.dataset.text)
  let score = 0

  for (const term of terms) {
    if (!title.includes(term) && !tags.includes(term) && !description.includes(term)
      && !kind.includes(term) && !text.includes(term)) {
      return undefined
    }

    if (title === term) score += 1000
    else if (title.startsWith(term)) score += 700
    else if (title.includes(term)) score += 500
    if (tags.includes(term)) score += 300
    if (description.includes(term)) score += 150
    if (kind.includes(term)) score += 100
    if (text.includes(term)) score += 50
  }

  return score
}

function applySearch(list: HTMLElement, query: string): number {
  const items = Array.from(list.querySelectorAll<HTMLElement>('li[data-search-item]'))
  const terms = normalized(query).split(/\s+/).filter(Boolean)
  const ranked = items
    .map((item, index) => {
      if (item.dataset.order === undefined) item.dataset.order = String(index)
      const score = terms.length === 0 ? 0 : scoreResult(item, terms)
      return { item, score, order: Number(item.dataset.order) }
    })
    .sort((left, right) => (
      (right.score ?? -1) - (left.score ?? -1) || left.order - right.order
    ))

  for (const result of ranked) {
    const matches = result.score !== undefined
    result.item.hidden = !matches
    if (matches) list.append(result.item)
  }
  return ranked.filter(({ score }) => score !== undefined).length
}

// Filters a server-rendered #search-list by toggling `hidden` on its <li>
// children. The full entry collection is never serialized into the island.
function SearchComponent({ listId, indexUrl }: { listId: string; indexUrl: string }) {
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tag = params.get('tag')
    if (tag) setQuery(tag)
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetch(indexUrl)
      .then((response) => response.ok ? response.json() as Promise<{ items?: SearchItem[] }> : Promise.reject(new Error('Search index unavailable')))
      .then((index) => {
        if (cancelled || !Array.isArray(index.items)) return
        const list = document.getElementById(listId)
        if (!list) return
        const fragment = document.createDocumentFragment()
        for (const [order, item] of index.items.entries()) {
          if (!item || typeof item.title !== 'string' || typeof item.href !== 'string') continue
          const result = document.createElement('li')
          result.className = 'search-result'
          result.dataset.searchItem = ''
          result.dataset.order = String(order)
          result.dataset.title = item.title
          result.dataset.description = item.description ?? ''
          result.dataset.kind = item.kind ?? ''
          result.dataset.tags = (item.tags ?? []).join(' ')
          result.dataset.text = item.text ?? ''
          result.dataset.search = [item.title, item.description, item.kind, ...(item.tags ?? [])]
            .filter(Boolean)
            .join(' ')
          const link = document.createElement('a')
          link.href = item.href
          const kind = document.createElement('span')
          kind.className = 'eyebrow'
          kind.textContent = item.kind ?? 'Page'
          const title = document.createElement('strong')
          title.textContent = item.title
          const description = document.createElement('span')
          description.textContent = item.description ?? ''
          link.append(kind, title, description)
          result.append(link)
          fragment.append(result)
        }
        list.replaceChildren(fragment)
        setLoaded(true)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [indexUrl, listId])

  useEffect(() => {
    const list = document.getElementById(listId)
    if (!list) {
      setVisible(0)
      return
    }

    setVisible(applySearch(list, query))
  }, [query, listId, loaded])

  return (
    <div className="search-tool">
      <label htmlFor="site-search">Search the site</label>
      <div className="search-tool__input-row">
        <input
          id="site-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “algorithms”, “recipe”, or a tag"
        />
        {query && <button type="button" className="search-clear" onClick={() => setQuery('')}>Clear</button>}
      </div>
      <p className="search-status" aria-live="polite">
        {visible === null ? 'Search the archive' : `${visible} result${visible === 1 ? '' : 's'}`}
      </p>
    </div>
  )
}

export default defineIsland('search', SearchComponent)
