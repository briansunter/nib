import { siteHref, type PageProps } from '@briansunter/nib'
import type { CSSProperties, ReactNode } from 'react'
import type config from '../../../nib.config'
import { PinFilter } from '../../client-behaviors'

export const meta = {
  title: 'Pin Collection | Brian Sunter',
  description: 'My lapel pin collection - enamel pins, badges, and collectibles.',
}

type IconName =
  | 'arrow-left'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'close-circle'
  | 'fit'
  | 'fullscreen'
  | 'fullscreen-exit'
  | 'grid'
  | 'label'
  | 'magnify'
  | 'map'
  | 'minus'
  | 'plus'
  | 'sort'
  | 'star'
  | 'star-outline'

const paths: Record<IconName, ReactNode> = {
  'arrow-left': <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2Z" />,
  'chevron-left': <path d="M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41Z" />,
  'chevron-right': <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41Z" />,
  close: <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z" />,
  'close-circle': <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59Z" />,
  fit: <path d="M7 3H3v4h2V5h2V3Zm14 4V3h-4v2h2v2h2ZM5 17H3v4h4v-2H5v-2Zm14 2h-2v2h4v-4h-2v2ZM8 8h8v8H8V8Z" />,
  fullscreen: <path d="M7 14H5v5h5v-2H7v-3Zm-2-4h2V7h3V5H5v5Zm12 7h-3v2h5v-5h-2v3Zm-3-12v2h3v3h2V5h-5Z" />,
  'fullscreen-exit': <path d="M5 16h3v3h2v-5H5v2Zm3-8H5v2h5V5H8v3Zm6 11h2v-3h3v-2h-5v5Zm2-11V5h-2v5h5V8h-3Z" />,
  grid: <path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" />,
  label: <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16ZM16 17H5V7h11l3.55 5L16 17Z" />,
  magnify: <path d="M9.5 3a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-6.36-6.37A6.5 6.5 0 0 0 9.5 3Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" />,
  map: <path d="m15 19-6-2.1L4.35 18.7A1 1 0 0 1 3 17.77V5.7a1 1 0 0 1 .65-.94L9 2.7l6 2.1 4.65-1.8A1 1 0 0 1 21 3.93V16a1 1 0 0 1-.65.94L15 19Zm-1-2.47V6.57l-4-1.4v9.96l4 1.4Zm2-.02 3-1.16V5.39l-3 1.16v9.96ZM5 16.31l3-1.16V5.19L5 6.35v9.96Z" />,
  minus: <path d="M9 11v2h6v-2H9Zm1.5-8a7.5 7.5 0 1 1-4.73 13.32L2 20.09 3.41 21.5l3.77-3.77A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" />,
  plus: <path d="M9.5 7v3.5H6v2h3.5V16h2v-3.5H15v-2h-3.5V7h-2Zm1-4a7.5 7.5 0 1 1-4.73 13.32L2 20.09 3.41 21.5l3.77-3.77A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" />,
  sort: <path d="M3 18h6v-2H3v2Zm0-5h12v-2H3v2Zm0-7v2h18V6H3Z" />,
  star: <path d="m12 17.27 6.18 3.73-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27Z" />,
  'star-outline': <path d="m12 15.39-3.76 2.27 1-4.28-3.32-2.88 4.38-.37L12 6.09l1.7 4.04 4.38.37-3.32 2.88 1 4.28L12 15.39ZM12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2Z" />,
}

function Icon({
  name,
  className = 'h-5 w-5',
  ...props
}: {
  name: IconName
  className?: string
  'data-mode-icon'?: string
  'data-fs-icon'?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}

function formatAcquired(date: string): string {
  if (!date) return ''
  const value = new Date(date)
  if (!Number.isFinite(value.getTime())) return date
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(value)
}

export default function PinCollectionPage({ collections }: PageProps<typeof config>) {
  const collection = collections.pins[0]?.data
  if (!collection) return null

  const pins = [...collection.pins].sort((a, b) => {
    const dateDifference = new Date(b.dateAcquired || 0).getTime()
      - new Date(a.dateAcquired || 0).getTime()
    return dateDifference
  })
  const categories = [...new Set(pins.map((pin) => pin.category))]
    .map((name) => ({ name, count: pins.filter((pin) => pin.category === name).length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  const markers = pins.flatMap((pin) => pin.gps && pin.image
    ? [{
        id: pin.id,
        name: pin.name,
        subtitle: pin.acquiredAt,
        lat: pin.gps.lat,
        lng: pin.gps.lng,
        thumbnail: siteHref(pin.image),
      }]
    : [])
  const pinDetails = pins.map((pin) => ({
    id: pin.id,
    name: pin.name,
    description: pin.description,
    category: pin.category,
    acquired: formatAcquired(pin.dateAcquired),
    acquiredAt: pin.acquiredAt,
    maker: pin.maker,
    source: pin.source,
    tags: pin.tags,
    favorite: pin.favorite,
    image: {
      src: pin.image ? siteHref(pin.image) : '',
      width: 1200,
      height: 1200,
    },
    gps: pin.gps,
  }))
  const serializedPinDetails = JSON.stringify(pinDetails).replaceAll('<', '\\u003c')

  return (
    <>
      <div className="pin-page-shell">
        <section className="display-case">
          <div className="pin-board-layer">
            <p id="pin-filter-status" className="sr-only" aria-live="polite">
              Showing {pins.length} of {pins.length} pins
            </p>

            <div id="pin-nav-wrapper">
              <nav id="pin-nav" className="pin-board-nav">
                <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 lg:px-8">
                  <div className="grid gap-3 xl:grid-cols-[auto_minmax(14rem,1fr)_auto] xl:items-center">
                    <h1 className="pin-board-title flex items-baseline gap-2 whitespace-nowrap pl-1">
                      {collection.name}
                      <span className="pin-board-count">
                        <span id="visible-count">{pins.length}</span>
                      </span>
                    </h1>

                    <label className="relative block min-w-0 flex-1">
                      <span className="sr-only">Search pins</span>
                      <Icon name="magnify" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/48" />
                      <input
                        id="pin-search-input"
                        className="pin-search-field h-11 w-full pl-10 pr-3 text-sm"
                        type="search"
                        autoComplete="off"
                        placeholder="Search pins, places, makers, tags…"
                      />
                    </label>

                    <div className="flex flex-wrap items-center justify-end gap-2 xl:flex-nowrap">
                      <button
                        id="favorites-toggle"
                        className="pin-tool-button flex flex-shrink-0 items-center justify-center gap-1.5 px-3 text-sm font-semibold"
                        aria-label="Show favorites only"
                        aria-pressed="false"
                        type="button"
                      >
                        <Icon name="star-outline" className="h-5 w-5 flex-shrink-0" />
                        <span className="desktop-label">Favorites</span>
                      </button>

                      <button
                        id="hide-text-toggle"
                        className="pin-tool-button flex flex-shrink-0 items-center justify-center gap-1.5 px-3 text-sm font-semibold"
                        aria-label="Toggle pin labels"
                        aria-pressed="false"
                        type="button"
                      >
                        <Icon name="label" className="h-5 w-5 flex-shrink-0" />
                        <span className="desktop-label">Labels</span>
                      </button>

                      <button
                        id="pin-view-toggle"
                        className="pin-tool-button flex flex-shrink-0 items-center justify-center gap-1.5 px-3 text-sm font-semibold"
                        aria-label="Toggle map view"
                        aria-pressed="false"
                        data-mode="grid"
                        type="button"
                      >
                        <Icon name="map" className="h-5 w-5 flex-shrink-0" data-mode-icon="grid" />
                        <Icon name="grid" className="hidden h-5 w-5 flex-shrink-0" data-mode-icon="map" />
                        <span className="desktop-label" data-mode-label="grid">Map</span>
                        <span className="desktop-label hidden" data-mode-label="map">Grid</span>
                      </button>

                      <button
                        id="pin-clear-filters"
                        className="pin-tool-button hidden inline-flex flex-shrink-0 items-center justify-center gap-1.5 px-3 text-sm font-semibold"
                        type="button"
                      >
                        <Icon name="close-circle" className="h-5 w-5 flex-shrink-0" />
                        <span>Clear</span>
                      </button>

                      <div className="relative flex-shrink-0">
                        <button
                          id="pin-sort-btn"
                          className="dropdown-btn pin-tool-button flex items-center justify-center gap-1.5 px-3 text-sm font-semibold"
                          aria-label="Sort pins"
                          aria-expanded="false"
                          type="button"
                        >
                          <Icon name="sort" className="h-5 w-5 flex-shrink-0" />
                          <span id="pin-current-sort" className="desktop-label">Newest</span>
                        </button>
                        <div id="pin-sort-menu" className="dropdown-menu absolute right-0 top-full z-[1001] mt-2 w-52 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-white/15 bg-[#0b2119]/95 py-1 shadow-2xl backdrop-blur-xl transition-[opacity,visibility] duration-150">
                          <button type="button" data-sort="newest" className="sort-option w-full px-4 py-2.5 text-left text-sm font-semibold text-white/82 transition-colors hover:bg-white/10">Newest First{' '}</button>
                          <button type="button" data-sort="oldest" className="sort-option w-full px-4 py-2.5 text-left text-sm text-white/72 transition-colors hover:bg-white/10">Oldest First{' '}</button>
                          <button type="button" data-sort="name" className="sort-option w-full px-4 py-2.5 text-left text-sm text-white/72 transition-colors hover:bg-white/10">Name A-Z{' '}</button>
                          <button type="button" data-sort="category" className="sort-option w-full px-4 py-2.5 text-left text-sm text-white/72 transition-colors hover:bg-white/10">Category{' '}</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2 overflow-x-auto pin-board-scroll pb-1" role="group" aria-label="Filter by category">
                    <button className="pin-chip category-filter selected flex-shrink-0 px-3 text-sm font-semibold" type="button" data-category="all" aria-pressed="true">
                      All <span className="ml-1 tabular-nums opacity-70">{pins.length}</span>
                    </button>
                    {categories.map((category) => (
                      <button
                        className="pin-chip category-filter flex-shrink-0 px-3 text-sm font-semibold"
                        type="button"
                        data-category={category.name}
                        aria-pressed="false"
                        key={category.name}
                      >
                        {category.name} <span className="ml-1 tabular-nums opacity-70">{category.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </nav>
            </div>

            <div className="pin-board-content relative z-[2] px-3 pb-12 pt-7 sm:px-6 sm:pb-16 lg:px-8">
              <div
                id="pin-grid"
                className="mx-auto grid max-w-7xl grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-9 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              >
                {pins.map((pin, index) => {
                  const offset = ((index * 11) % 5) - 2
                  const scale = 0.94 + ((index * 5) % 11) / 100
                  const imageMax = 116 + ((index * 13) % 26)
                  const searchText = [
                    pin.name,
                    pin.description,
                    pin.category,
                    pin.acquiredAt,
                    pin.source,
                    pin.maker,
                    ...pin.tags,
                  ].filter(Boolean).join(' ')
                  const style = {
                    '--pin-offset': `${offset}px`,
                    '--pin-scale': scale,
                    '--pin-image-max': `${imageMax}px`,
                  } as CSSProperties

                  return (
                    <article
                      className="pin-card group relative"
                      data-pin-id={pin.id}
                      data-category={pin.category}
                      data-tags={pin.tags.join(',')}
                      data-favorite={pin.favorite ? 'true' : 'false'}
                      data-date={pin.dateAcquired}
                      data-index={index}
                      data-name={pin.name}
                      data-search={searchText}
                      style={style}
                      key={pin.id}
                    >
                      <button
                        className="pin-card-trigger flex w-full cursor-pointer flex-col items-center rounded-lg border-0 bg-transparent p-0 text-inherit"
                        type="button"
                        data-pin-id={pin.id}
                        aria-controls="pin-modal"
                        aria-haspopup="dialog"
                      >
                        <div className="pin-card-inner flex w-full flex-col items-center transition-transform duration-300 ease-out">
                          <div className="pin-shadow relative flex h-36 w-full items-center justify-center overflow-visible px-3 sm:h-40">
                            {pin.image && (
                              <img
                                src={siteHref(pin.image)}
                                alt=""
                                width="240"
                                sizes="180px"
                                data-nib-width="240"
                                data-nib-widths="160,240"
                                loading={index < 12 ? 'eager' : 'lazy'}
                                decoding="async"
                                style={{ maxWidth: 'min(82%, var(--pin-image-max))', maxHeight: 'var(--pin-image-max)' }}
                                className="pin-card-image relative z-[2] object-contain transition-transform duration-300 ease-out"
                              />
                            )}
                            {pin.favorite && (
                              <div className="favorite-star absolute right-3 top-1 z-[3]">
                                <Icon name="star" className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="pin-label mt-3 flex min-h-8 max-w-full items-start justify-center px-1 text-center transition-[opacity,transform] duration-200">
                            <span className="pin-label-text max-w-full rounded-md bg-black/30 px-2.5 py-1 text-sm font-semibold tracking-tight text-white shadow-md ring-1 ring-white/10 backdrop-blur-sm">
                              {pin.name}
                            </span>
                            <span className="sr-only">, view details</span>
                          </div>
                        </div>
                      </button>
                    </article>
                  )
                })}
              </div>

              {pins.length === 0 && (
                <div className="mx-auto max-w-xl py-24 text-center text-white/60">
                  <p className="text-lg font-semibold">No pins yet.</p>
                  <p className="mt-2 text-sm">Add your first pin to pins.yaml.</p>
                </div>
              )}

              <div id="pin-no-results" className="mx-auto hidden max-w-xl py-24 text-center text-white/68">
                <p className="text-xl font-bold text-white/86">No pins match those filters</p>
                <p className="mt-2 text-sm text-white/58">Clear the board controls to bring every pin back.</p>
                <button
                  id="pin-reset-filters"
                  className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-white/18 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--felt-brass)]"
                  type="button"
                >
                  Clear filters
                </button>
              </div>
            </div>

            <section id="pin-map-view" className="pin-map-section hidden relative z-[2]" aria-hidden="true">
              <div id="pin-map-wrap" className="pin-map-wrap pin-map-wrap-default relative">
                <div
                  id="pin-map"
                  className="pin-map-canvas h-full w-full overflow-hidden"
                  data-markers={JSON.stringify(markers)}
                />
                <div className="pin-map-bottom-bar">
                  <button type="button" id="pin-map-back" className="pin-map-back-btn" aria-label="Back to grid view">
                    <Icon name="arrow-left" className="h-[18px] w-[18px]" />
                  </button>
                  <div className="pin-map-meta-overlay" aria-hidden="true">
                    <span>
                      <span className="font-bold text-[var(--felt-cream)]">{markers.length}</span>{' '}
                      {markers.length === 1 ? 'pin' : 'pins'} mapped
                    </span>
                    {pins.length > markers.length && (
                      <span className="text-[var(--felt-cream)]/60">
                        · {pins.length - markers.length} without coordinates
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  id="pin-map-fullscreen"
                  className="pin-map-fullscreen-btn"
                  aria-label="Toggle full screen map"
                  aria-pressed="false"
                >
                  <Icon name="fullscreen" data-fs-icon="expand" className="h-[18px] w-[18px]" />
                  <Icon name="fullscreen-exit" data-fs-icon="collapse" className="hidden h-[18px] w-[18px]" />
                </button>
              </div>
            </section>
          </div>
        </section>
      </div>

      <dialog
        id="pin-modal"
        className="pin-detail-dialog m-auto max-h-[calc(100dvh-2rem)] w-[min(72rem,calc(100vw-2rem))] overflow-visible rounded-xl border border-white/12 bg-transparent p-0 text-ink"
        aria-labelledby="pin-modal-title"
        aria-describedby="pin-modal-description"
      >
        <article className="pin-detail relative overflow-hidden rounded-xl border border-white/10 bg-surface-elevated" data-pin-id="">
          <button id="pin-modal-close" className="pin-dialog-icon-button absolute right-3 top-3 z-30" type="button" aria-label="Close pin details">
            <Icon name="close" className="h-6 w-6" />
          </button>

          <div className="pin-detail-layout grid min-h-[34rem] grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
            <div
              className="pin-zoom-container relative flex min-h-[34rem] select-none items-center justify-center overflow-hidden"
              style={{ background: 'var(--felt-gradient)', boxShadow: 'inset 0 2px 18px rgba(0,0,0,0.34)', touchAction: 'none' }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(0deg, rgba(0,0,0,0.14) 1px, transparent 1px)', backgroundSize: '18px 18px, 22px 22px' }}
              />
              <div className="pin-zoom-wrapper relative z-[1] flex h-full w-full items-center justify-center p-10" style={{ transformOrigin: 'center center' }}>
                <img id="pin-detail-image" alt="" decoding="async" className="pin-zoom-img pointer-events-none max-h-[31rem] max-w-full object-contain drop-shadow-[0_16px_38px_var(--felt-shadow-deep)]" />
              </div>

              <div className="pin-image-tools absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/14 bg-black/54 p-1 backdrop-blur-md" aria-label="Image zoom controls">
                <button className="pin-image-tool pin-zoom-out" type="button" aria-label="Zoom out"><Icon name="minus" /></button>
                <button className="pin-image-tool pin-zoom-reset" type="button" aria-label="Reset zoom"><Icon name="fit" /></button>
                <button className="pin-image-tool pin-zoom-in" type="button" aria-label="Zoom in"><Icon name="plus" /></button>
                <button className="pin-image-tool pin-fullscreen-btn" type="button" aria-label="View pin image fullscreen" aria-pressed="false"><Icon name="fullscreen" /></button>
              </div>

              <p className="pin-zoom-hint pointer-events-none absolute left-4 top-4 rounded bg-black/42 px-2 py-1 text-xs font-semibold text-white/74">
                Scroll, pinch, or use controls to zoom
              </p>
              <output className="pin-zoom-level pointer-events-none absolute right-4 top-4 rounded bg-black/42 px-2 py-1 text-xs font-semibold text-white/84" aria-live="polite">100%</output>
            </div>

            <div className="pin-detail-copy overflow-y-auto border-l border-border-subtle p-6 pr-14 sm:p-8 sm:pr-16">
              <p id="pin-detail-category" className="text-xs font-bold uppercase tracking-[0.16em] text-ink-secondary" />
              <h2 id="pin-modal-title" className="mt-2 text-3xl font-bold leading-tight tracking-tight text-ink" />
              <span id="pin-detail-favorite" className="favorite-star mt-2 inline-flex items-center gap-1 text-sm font-semibold" hidden>
                <Icon name="star" className="h-4 w-4" />
                Favorite
              </span>
              <p id="pin-modal-description" className="mt-4 text-base leading-relaxed text-ink-secondary" hidden />

              <dl className="pin-detail-metadata mt-7 divide-y divide-[var(--color-border)] text-sm">
                <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3">
                  <dt>Acquired</dt>
                  <dd id="pin-detail-acquired" className="font-semibold text-ink" />
                </div>
                <div data-pin-field="acquired-at" className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3" hidden>
                  <dt>Location</dt>
                  <dd id="pin-detail-acquired-at" className="font-semibold text-ink" />
                </div>
                <div data-pin-field="maker" className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3" hidden>
                  <dt>Maker</dt>
                  <dd id="pin-detail-maker" className="font-semibold text-ink" />
                </div>
                <div data-pin-field="source" className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-3" hidden>
                  <dt>Source</dt>
                  <dd id="pin-detail-source" className="font-semibold capitalize text-ink" />
                </div>
              </dl>

              <div id="pin-detail-tags" className="mt-6 flex flex-wrap gap-1.5" hidden />
              <div id="pin-detail-map" className="mt-7 h-48 w-full overflow-hidden rounded-lg border border-border bg-surface-subtle" hidden />
            </div>
          </div>

          <button className="pin-nav-prev pin-dialog-nav-button left-3" type="button" aria-label="Previous pin">
            <Icon name="chevron-left" className="h-7 w-7" />
          </button>
          <button className="pin-nav-next pin-dialog-nav-button right-3" type="button" aria-label="Next pin">
            <Icon name="chevron-right" className="h-7 w-7" />
          </button>
        </article>
      </dialog>

      <script
        id="pin-detail-data"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: serializedPinDetails }}
      />
      <PinFilter props={{}} />
    </>
  )
}
