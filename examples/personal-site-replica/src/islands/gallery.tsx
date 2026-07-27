import { useEffect, useMemo, useState } from 'react'
import { defineIsland, siteHref } from '@briansunter/nib'
import PhotoSwipeLightbox from 'photoswipe/lightbox'
import 'photoswipe/dist/photoswipe.css'

type GalleryVariant = 'photos' | 'art'
type FilterKind = 'location' | 'medium' | 'tag'

interface CollectionOption {
  id: string
  name: string
  count: number
}

interface FilterOption {
  kind: FilterKind
  value: string
  label: string
}

interface GalleryProps {
  galleryId: string
  variant: GalleryVariant
  collections: CollectionOption[]
  filters: FilterOption[]
}

function icon(kind: 'grid' | 'list' | 'filter') {
  if (kind === 'grid') return '▦'
  if (kind === 'list') return '☰'
  return '☷'
}

function GalleryControls({ galleryId, variant, collections, filters }: GalleryProps) {
  const [collection, setCollection] = useState('all')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filterOpen, setFilterOpen] = useState(false)

  const groups = useMemo(() => {
    const grouped = new Map<FilterKind, FilterOption[]>()
    for (const filter of filters) grouped.set(filter.kind, [...(grouped.get(filter.kind) ?? []), filter])
    return [...grouped.entries()]
  }, [filters])

  useEffect(() => {
    const gallery = document.getElementById(galleryId)
    if (!gallery) return

    const items = [...gallery.querySelectorAll<HTMLElement>('.gallery-item')]
    const applyFilters = () => {
      for (const item of items) {
        const collectionMatch = collection === 'all' || item.dataset.collection === collection
        const filterMatch = activeFilters.length === 0 || activeFilters.every((filter) => {
          const [kind, value] = filter.split(':')
          const source = item.dataset[kind === 'location' ? 'location' : kind === 'medium' ? 'medium' : 'tags'] ?? ''
          return source.split(',').map((entry) => entry.trim()).includes(value ?? '')
        })
        const hidden = !(collectionMatch && filterMatch)
        item.toggleAttribute('hidden', hidden)
        if (hidden) item.setAttribute('data-gallery-hidden', 'true')
        else item.removeAttribute('data-gallery-hidden')
      }
      gallery.setAttribute('data-view', view)
      gallery.classList.toggle('list-view', view === 'list')
      gallery.classList.toggle('grid-view', view === 'grid')
    }

    applyFilters()
    let lightbox: PhotoSwipeLightbox | undefined
    let cancelled = false

    const createLightbox = async () => {
      const visibleChildren = 'a.gallery-item-link:not([data-gallery-hidden="true"])'
      const instance = new PhotoSwipeLightbox({
        gallery: `#${galleryId}`,
        children: visibleChildren,
        pswpModule: () => import('photoswipe'),
        bgOpacity: 0.94,
        showHideAnimationType: 'zoom',
      })

      instance.on('uiRegister', function (this: any) {
        this.ui.registerElement({
          name: 'caption',
          order: 9,
          isButton: false,
          appendTo: 'root',
          className: 'pswp__custom-caption',
          onInit: (element: HTMLElement, pswp: any) => {
            const update = () => {
              const anchor = pswp.currSlide?.data?.element as HTMLElement | undefined
              element.innerHTML = anchor?.getAttribute('data-caption') ?? ''
            }
            pswp.on('change', update)
            update()
          },
        })
      })
      instance.on('beforeOpen', () => {
        const index = Number(instance.options.index ?? 0)
        const anchors = [...gallery.querySelectorAll<HTMLAnchorElement>(visibleChildren)]
        const slug = anchors[index]?.dataset.gallerySlug
        if (slug) window.history.pushState({ nibGallery: true }, '', `${window.location.pathname}?p=${encodeURIComponent(slug)}`)
      })
      instance.on('close', () => {
        if (new URLSearchParams(window.location.search).has('p')) {
          window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash)
        }
      })
      instance.init()
      if (cancelled) instance.destroy()
      else lightbox = instance
    }

    void createLightbox()
    const onPopState = () => {
      if (!new URLSearchParams(window.location.search).has('p')) lightbox?.pswp?.close()
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      cancelled = true
      window.removeEventListener('popstate', onPopState)
      lightbox?.destroy()
    }
  }, [activeFilters, collection, galleryId, view])

  function toggleFilter(filter: FilterOption) {
    const key = `${filter.kind}:${filter.value}`
    setActiveFilters((current) => current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key])
  }

  return (
    <div className={`gallery-toolbar gallery-toolbar--${variant}`} data-gallery-controls={galleryId}>
      <div className="gallery-toolbar__inner">
        <a className="gallery-toolbar__logo" href={siteHref('/')} aria-label="Back to home">BS</a>
        <label className="gallery-toolbar__select-label">
          <span className="sr-only">Select collection</span>
          <select value={collection} onChange={(event) => setCollection(event.currentTarget.value)} aria-label="Select collection">
            <option value="all">All collections</option>
            {collections.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} ({entry.count})</option>)}
          </select>
        </label>
        <div className="gallery-toolbar__spacer" />
        <div className="gallery-toolbar__actions">
          <div className="gallery-filter-control">
            <button type="button" className="gallery-toolbar__button" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>
              <span aria-hidden="true">{icon('filter')}</span> Filter {activeFilters.length > 0 && <b>{activeFilters.length}</b>}
            </button>
            {filterOpen && (
              <div className="gallery-filter-menu" role="group" aria-label="Gallery filters">
                {groups.map(([kind, options]) => (
                  <fieldset key={kind}>
                    <legend>{kind === 'location' ? 'Location' : kind === 'medium' ? 'Medium' : 'Tags'}</legend>
                    {options.map((filter) => {
                      const key = `${filter.kind}:${filter.value}`
                      return <button type="button" className={activeFilters.includes(key) ? 'is-active' : ''} aria-pressed={activeFilters.includes(key)} onClick={() => toggleFilter(filter)} key={key}>{filter.label}</button>
                    })}
                  </fieldset>
                ))}
                {activeFilters.length > 0 && <button type="button" className="gallery-filter-menu__clear" onClick={() => setActiveFilters([])}>Clear all filters</button>}
              </div>
            )}
          </div>
          <div className="gallery-view-toggle" aria-label="Gallery view">
            <button type="button" className={view === 'grid' ? 'is-active' : ''} aria-pressed={view === 'grid'} onClick={() => setView('grid')}><span aria-hidden="true">{icon('grid')}</span><span className="gallery-toolbar__desktop-label">Grid</span></button>
            <button type="button" className={view === 'list' ? 'is-active' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}><span aria-hidden="true">{icon('list')}</span><span className="gallery-toolbar__desktop-label">List</span></button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default defineIsland('gallery', GalleryControls)
