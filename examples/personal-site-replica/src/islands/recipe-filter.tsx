import { defineIsland } from '@briansunter/nib'
import { useEffect, useRef, useState } from 'react'
import { trackEvent } from '../lib/analytics'
import { categoryIcon } from '../lib/recipes'

interface TagOption { value: string; count: number }

function RecipeFilter({
  categories,
  tags,
  listId,
  total,
}: {
  categories: TagOption[]
  tags: TagOption[]
  listId: string
  total: number
}) {
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [visible, setVisible] = useState(total)
  const [restored, setRestored] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const restoreFromUrl = () => {
      const params = new URLSearchParams(window.location.search)
      setQuery(params.get('q')?.trim() ?? '')
      setSelectedTags((params.get('tags') ?? '').split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))
      setRestored(true)
    }
    const recipeList = document.querySelector<HTMLElement>('[data-recipe-list]')
    const trackCardClick = (event: Event) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('[data-recipe-card-link]')
      if (!link) return
      trackEvent('recipe_card_click', {
        slug: link.dataset.recipeSlug ?? '',
        source: 'recipes',
      })
    }

    restoreFromUrl()
    window.addEventListener('popstate', restoreFromUrl)
    recipeList?.addEventListener('click', trackCardClick)
    return () => {
      window.removeEventListener('popstate', restoreFromUrl)
      recipeList?.removeEventListener('click', trackCardClick)
      window.clearTimeout(searchTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!restored) return
    const list = document.getElementById(listId)
    if (!list) return
    const normalized = query.trim().toLowerCase()
    let count = 0
    for (const card of list.querySelectorAll<HTMLElement>('[data-recipe-card]')) {
      const search = (card.dataset.search ?? card.textContent ?? '').toLowerCase()
      const cardTags = (card.dataset.tags ?? '').split(',').map((tag) => tag.toLowerCase())
      const matches = (!normalized || search.includes(normalized))
        && selectedTags.every((tag) => cardTags.includes(tag))
      card.hidden = !matches
      if (matches) count += 1
    }
    const empty = document.querySelector<HTMLElement>('[data-recipe-empty]')
    if (empty) empty.hidden = count > 0
    setVisible(count)
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (selectedTags.length) params.set('tags', selectedTags.join(','))
    const suffix = params.size ? `?${params.toString()}` : ''
    window.history.replaceState({}, '', `${window.location.pathname}${suffix}`)
  }, [listId, query, restored, selectedTags])

  const toggle = (value: string) => {
    setSelectedTags((current) => {
      const removing = current.includes(value)
      const next = removing
        ? current.filter((tag) => tag !== value)
        : [...current, value]
      trackEvent('recipe_filter_toggle', {
        action: removing ? 'remove' : 'add',
        selected_tag_count: next.length,
        tag: value,
      })
      return next
    })
  }
  const active = Boolean(query.trim() || selectedTags.length)
  const tagButton = (option: TagOption, category: boolean) => {
    const icon = category ? categoryIcon(option.value) : null
    return (
      <button
        type="button"
        className={`chip ${category ? 'chip--category' : 'chip--pill'}${selectedTags.includes(option.value) ? ' is-selected' : ''}`}
        data-recipe-tag={option.value}
        aria-pressed={selectedTags.includes(option.value)}
        onClick={() => toggle(option.value)}
        key={option.value}
      >
        {icon && (
          <svg
            aria-hidden="true"
            className="h-3.5 w-3.5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            dangerouslySetInnerHTML={{ __html: icon }}
          />
        )}
        <span>{option.value}</span>{' '}
        <span className="chip-count text-xs">{option.count}</span>{' '}
      </button>
    )
  }
  return (
    <div className="space-y-3 font-sans" aria-label="Filter recipes">
      <div className="relative w-full sm:max-w-md">
        <label htmlFor="recipe-search" className="sr-only">Search recipes</label>
        <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
        </svg>
        <input
          id="recipe-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Search recipes…"
          className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          data-recipe-search
          ref={inputRef}
          value={query}
          onChange={(event) => {
            const value = event.currentTarget.value
            setQuery(value)
            window.clearTimeout(searchTimerRef.current)
            if (!value.trim()) return
            searchTimerRef.current = window.setTimeout(() => {
              const list = document.getElementById(listId)
              const resultCount = list
                ? [...list.querySelectorAll<HTMLElement>('[data-recipe-card]')]
                    .filter((card) => !card.hidden).length
                : 0
              trackEvent('recipe_search', {
                query_length: value.trim().length,
                result_count: resultCount,
                selected_tag_count: selectedTags.length,
              })
            }, 800)
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">{categories.map((option) => tagButton(option, true))}</div>
      <div className="flex flex-wrap items-center gap-2">{tags.map((option) => tagButton(option, false))}</div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted" data-recipe-results aria-live="polite" hidden={!active}>
        <span><strong className="font-medium text-ink-secondary tabular-nums" data-recipe-visible-count>{visible}</strong> of <span data-recipe-total>{total}</span> recipes</span>
        <button
          type="button"
          className="font-medium text-ink-secondary underline underline-offset-2 hover:text-ink"
          data-recipe-clear
          hidden={!active}
          onClick={() => {
            trackEvent('recipe_filter_clear', {
              had_filter_text: Boolean(query),
              selected_tag_count: selectedTags.length,
            })
            setQuery('')
            setSelectedTags([])
            inputRef.current?.focus()
          }}
        >
          Clear
        </button>
      </p>
    </div>
  )
}

export default defineIsland('recipe-filter', RecipeFilter)
