import { defineIsland } from '@briansunter/nib'
import { useEffect, useRef, useState } from 'react'

// One coordinated island for the pin collection. The full pin grid is
// server-rendered in the page with normalized data attributes; this island
// receives only the small category/tag control lists plus the grid/dialog ids.
// It owns filter/sort state, reorders and toggles the SSR <li> items directly,
// and renders a single React <dialog> detail view driven by the same data
// attributes (the collection is never serialized into island props).
//
// Filter/sort logic mirrors ../personal-site/src/utils/pin-collection/filters-sort.ts,
// narrowed to the replica schema: `acquiredAt` is a location string, not a
// date, so the sort menu only offers Name A-Z and Category.

type SortKey = 'name' | 'category'

interface PinFilterProps {
  categories: string[]
  tags: string[]
  gridId: string
}

interface PinRecord {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  favorite: boolean
  maker: string
  acquired: string
  image: string
}

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase()
}

function readCards(gridId: string): HTMLElement[] {
  const grid = document.getElementById(gridId)
  if (!grid) return []
  return Array.from(grid.querySelectorAll<HTMLElement>('li[data-pin-id]'))
}

function toRecord(card: HTMLElement): PinRecord {
  const cardImage = card.querySelector<HTMLImageElement>('img')
  return {
    id: card.dataset.pinId ?? '',
    name: card.dataset.name ?? '',
    description: card.dataset.description ?? '',
    category: card.dataset.category ?? '',
    tags: (card.dataset.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
    favorite: card.dataset.favorite === 'true',
    maker: card.dataset.maker ?? '',
    acquired: card.dataset.acquired ?? '',
    // Production content-image rewriting replaces the card image with a
    // responsive optimized candidate. Reuse the browser's selected candidate
    // for the detail view instead of fetching the authored full-size source.
    image: cardImage?.currentSrc || cardImage?.src || card.dataset.image || '',
  }
}

function PinFilterComponent({ categories, tags, gridId }: PinFilterProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('name')
  const [visibleCount, setVisibleCount] = useState<number | null>(null)
  const [noResults, setNoResults] = useState(false)
  const [current, setCurrent] = useState<PinRecord | null>(null)

  const dialogRef = useRef<HTMLDialogElement>(null)
  const lastTriggerRef = useRef<HTMLElement | null>(null)

  // Filter + reorder the server-rendered grid. Hidden toggles visibility and
  // appendChild reorders the DOM; the original SSR order (data-index) breaks
  // ties so the result is stable across filter changes.
  useEffect(() => {
    const cards = readCards(gridId)
    const searchTerms = normalize(query).split(/\s+/).filter(Boolean)
    cards.sort((a, b) => {
      const primary = sort === 'category'
        ? normalize(a.dataset.category).localeCompare(normalize(b.dataset.category))
          || normalize(a.dataset.name).localeCompare(normalize(b.dataset.name))
        : normalize(a.dataset.name).localeCompare(normalize(b.dataset.name))
      return primary !== 0
        ? primary
        : Number(a.dataset.index ?? 0) - Number(b.dataset.index ?? 0)
    })
    const grid = document.getElementById(gridId)
    let visible = 0
    for (const card of cards) {
      if (grid) grid.appendChild(card)
      const searchable = normalize(card.dataset.search)
      const matchesSearch = searchTerms.length === 0
        || searchTerms.every((term) => searchable.includes(term))
      const matchesCategory = category === 'all'
        || normalize(card.dataset.category) === normalize(category)
      const cardTags = normalize(card.dataset.tags).split(',').filter(Boolean)
      const matchesTags = selectedTags.size === 0
        || cardTags.some((tag) => selectedTags.has(tag))
      const matchesFavorite = !favoritesOnly || card.dataset.favorite === 'true'
      const show = matchesSearch && matchesCategory && matchesTags && matchesFavorite
      card.hidden = !show
      if (show) visible += 1
    }
    setVisibleCount(visible)
    setNoResults(cards.length > 0 && visible === 0)
  }, [query, category, selectedTags, favoritesOnly, sort, gridId])

  // Wire the server-rendered card triggers to the dialog. Listeners persist
  // across reorders because appendChild moves the same nodes.
  useEffect(() => {
    const triggers = document.querySelectorAll<HTMLButtonElement>('button[data-pin-trigger]')
    const open: Array<[HTMLElement, () => void]> = []
    triggers.forEach((trigger) => {
      const card = trigger.closest<HTMLElement>('li[data-pin-id]')
      if (!card) return
      const handler = () => {
        lastTriggerRef.current = trigger
        setCurrent(toRecord(card))
      }
      trigger.addEventListener('click', handler)
      open.push([trigger, handler])
    })
    return () => {
      for (const [trigger, handler] of open) trigger.removeEventListener('click', handler)
    }
  }, [gridId])

  // Drive the native <dialog> from React state.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (current) {
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
    } else if (dialog.open || dialog.hasAttribute('open')) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
      requestAnimationFrame(() => lastTriggerRef.current?.focus())
    }
  }, [current])

  function close() {
    setCurrent(null)
  }

  function navigate(direction: -1 | 1) {
    if (!current) return
    const ids = readCards(gridId).filter((card) => !card.hidden)
      .map((card) => card.dataset.pinId ?? '')
    const index = ids.indexOf(current.id)
    const nextId = ids[index + direction]
    if (!nextId) return
    const card = readCards(gridId).find((entry) => entry.dataset.pinId === nextId)
    if (card) setCurrent(toRecord(card))
  }

  function reset() {
    setQuery('')
    setCategory('all')
    setSelectedTags(new Set())
    setFavoritesOnly(false)
    setSort('name')
  }

  function toggleTag(tag: string) {
    const normalizedTag = normalize(tag)
    setSelectedTags((previous) => {
      const next = new Set(previous)
      if (next.has(normalizedTag)) next.delete(normalizedTag)
      else next.add(normalizedTag)
      return next
    })
  }

  // Visible-pin navigation bounds for the open modal.
  let navIndex = -1
  let navTotal = 0
  if (current) {
    const ids = readCards(gridId).filter((card) => !card.hidden)
      .map((card) => card.dataset.pinId ?? '')
    navTotal = ids.length
    navIndex = ids.indexOf(current.id)
  }

  return (
    <div className="pin-filter" id="pin-filter">
      <div className="pin-filter__controls">
        <label className="pin-filter__search">
          <span className="sr-only">Search pins</span>
          <input
            id="pin-search-input"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pins, places, makers, tags…"
          />
        </label>
        <label className="pin-filter__category">
          <span className="sr-only">Filter by category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
        <label className="pin-filter__sort">
          <span className="sr-only">Sort pins</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="name">Name A-Z</option>
            <option value="category">Category</option>
          </select>
        </label>
        <button
          id="pin-favorites-toggle"
          type="button"
          className="pin-chip"
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((value) => !value)}
        >
          Favorites only
        </button>
        <button type="button" className="pin-filter__reset" onClick={reset}>Reset</button>
      </div>

      {tags.length > 0 && (
        <div className="pin-filter__chips" role="group" aria-label="Filter by tag">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="pin-chip"
              aria-pressed={selectedTags.has(normalize(tag))}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <p className="pin-filter__status" id="pin-filter-status" aria-live="polite">
        {visibleCount === null ? 'Filtering…' : `${visibleCount} pin${visibleCount === 1 ? '' : 's'} shown`}
      </p>

      <p className="pin-filter__no-results" id="pin-no-results" hidden={!noResults}>
        No pins match the current filters.
      </p>

      <dialog
        id="pin-detail-dialog"
        ref={dialogRef}
        className="pin-detail-dialog"
        aria-label={current ? current.name : 'Pin details'}
        onCancel={(event) => { event.preventDefault(); close() }}
        onClick={(event) => { if (event.target === dialogRef.current) close() }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1) }
          else if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1) }
        }}
      >
        {current && (
          <div className="pin-detail">
            <button type="button" className="pin-detail__close" aria-label="Close details" onClick={close}>Close</button>
            {current.image ? (
              <img
                className="pin-detail__image"
                src={current.image}
                alt={`${current.name} enamel pin`}
                loading="eager"
                decoding="async"
              />
            ) : <span className="gradient-placeholder pin-detail__image" aria-hidden="true" />}
            <h2 className="pin-detail__title">{current.name}</h2>
            {current.description && <p className="pin-detail__description">{current.description}</p>}
            <dl className="pin-detail__meta">
              <div className="pin-detail__row">
                <dt>Category</dt>
                <dd>{current.category}</dd>
              </div>
              {current.maker && (
                <div className="pin-detail__row">
                  <dt>Maker</dt>
                  <dd>{current.maker}</dd>
                </div>
              )}
              {current.acquired && (
                <div className="pin-detail__row">
                  <dt>Acquired</dt>
                  <dd>{current.acquired}</dd>
                </div>
              )}
              {current.tags.length > 0 && (
                <div className="pin-detail__row">
                  <dt>Tags</dt>
                  <dd className="pin-detail__tags">
                    {current.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                  </dd>
                </div>
              )}
            </dl>
            <div className="pin-detail__nav">
              <button type="button" onClick={() => navigate(-1)} disabled={navIndex <= 0}>Previous</button>
              <button type="button" onClick={() => navigate(1)} disabled={navIndex < 0 || navIndex >= navTotal - 1}>Next</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}

export default defineIsland('pin-filter', PinFilterComponent)
