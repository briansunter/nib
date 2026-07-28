import { Fragment } from 'react'
import { siteHref } from '@briansunter/nib'
import {
  ArtGalleryBehavior,
  PhotoGalleryBehavior,
} from '../client-behaviors'

type GalleryVariant = 'photos' | 'art'
type FilterKind = 'location' | 'medium' | 'tag'
interface CollectionOption {
  id: string
  name: string
  count: number
}

interface FilterGroup {
  label: string
  values: Array<{ value: string; label: string }>
  kind: FilterKind
  prefix: string
  maxItems: number
}

interface GalleryProps {
  variant: GalleryVariant
  collections: CollectionOption[]
  filterGroups: FilterGroup[]
  filterAriaLabel: string
  gridLabel: string
  listLabel: string
}

function GalleryToolbar({
  variant,
  collections,
  filterGroups,
  filterAriaLabel,
  gridLabel,
  listLabel,
}: GalleryProps) {
  const firstCollectionName = collections[0]?.name || 'All'

  return (
    <div
      id="photo-nav-wrapper"
      className={variant === 'art' ? 'gallery-toolbar-art' : 'gallery-toolbar-photos'}
    >
      <nav id="collection-nav" className="bg-surface/98 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-3 lg:px-8">
          <div className="gallery-toolbar-row flex items-center py-1.5 md:py-2 gap-2 md:gap-3">
            <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-shrink-0">
              <a
                id="bs-logo"
                href={siteHref('/')}
                data-umami-event="gallery_home_click"
                data-umami-event-variant={variant}
                className="bs-logo flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center font-semibold text-sm hover:scale-105 active:scale-95"
                title="Back to home"
              >
                BS
              </a>

              <div className="relative">
                <button
                  id="collection-dropdown-btn"
                  type="button"
                  className="dropdown-btn flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 lg:py-2 rounded-md border border-border bg-surface-elevated text-sm lg:text-base font-medium text-ink-secondary hover:bg-surface-hover hover:border-ink-muted active:bg-surface-subtle transition-colors focus-accent"
                  aria-label="Select collection"
                  aria-expanded="false"
                >
                  <span id="selected-collection-name" className="max-w-[140px] md:max-w-[200px] truncate">
                    {firstCollectionName}
                  </span>
                  <svg className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-ink-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div id="collection-dropdown-menu" className="dropdown-menu absolute left-0 top-full mt-1.5 w-64 py-1.5 z-[1001] max-h-[60vh] overflow-y-auto overscroll-contain">
                  {collections.map((collection, index) => (
                    <a
                      href={`#${collection.id}`}
                      data-collection-id={collection.id}
                      data-collection-name={collection.name}
                      data-umami-event="gallery_collection_click"
                      data-umami-event-collection={collection.id}
                      data-umami-event-variant={variant}
                      className={[
                        'dropdown-option flex items-center justify-between px-4 py-3.5 text-sm transition-colors hover:bg-surface-hover active:bg-surface-subtle',
                        index === 0 ? 'active' : '',
                      ].join(' ')}
                      key={collection.id}
                    >
                      <span className="truncate">{collection.name}</span>
                      <span className="text-xs text-ink-muted tabular-nums ml-2 bg-surface-subtle px-1.5 py-0.5 rounded">
                        {collection.count}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-3 md:gap-2 flex-shrink-0">
              <div className="relative">
                <button
                  id="filter-dropdown-btn"
                  type="button"
                  className="dropdown-btn flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-border bg-surface-elevated hover:bg-surface-hover hover:border-ink-muted active:bg-surface-subtle transition-colors text-ink-secondary focus-accent"
                  aria-label={filterAriaLabel}
                  aria-expanded="false"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span className="desktop-label text-sm lg:text-base font-medium">Filter</span>
                  <span id="filter-count" className="hidden text-xs bg-ink text-surface rounded-full w-4 h-4 flex items-center justify-center font-medium">
                    0
                  </span>
                </button>
                <div id="filter-dropdown-menu" data-test="filter-system" className="dropdown-menu absolute right-0 top-full mt-1.5 w-64 py-1 z-[1001] max-h-[70vh] overflow-y-auto overscroll-contain">
                  <button
                    id="clear-all-filters"
                    type="button"
                    data-umami-event="gallery_filter_clear"
                    data-umami-event-variant={variant}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-accent hover:bg-surface-hover transition-colors hidden"
                  >
                    Clear all filters
                  </button>
                  <div id="clear-divider" className="hidden my-1 h-px bg-border" />

                  {filterGroups.map((group, groupIndex) => (
                    <Fragment key={`${group.kind}-${group.label}`}>
                      {groupIndex > 0 && <div className="my-2 h-px bg-border" />}
                      <div className="px-3 py-2 text-xs font-sans font-semibold text-ink-muted uppercase tracking-wider">
                        {group.label}
                      </div>
                      {group.values.slice(0, group.maxItems).map((entry) => {
                        const { value, label } = entry
                        return (
                          <button
                            type="button"
                            data-location={group.kind === 'location' ? value : undefined}
                            data-medium={group.kind === 'medium' ? value : undefined}
                            data-tag={group.kind === 'tag' ? value : undefined}
                            data-umami-event="gallery_filter_toggle"
                            data-umami-event-kind={group.kind}
                            data-umami-event-value={value}
                            data-umami-event-variant={variant}
                            aria-pressed="false"
                            data-test={group.kind === 'tag' ? 'tag-filter' : group.kind === 'medium' ? 'medium-filter' : 'location-filter'}
                            className={[
                              'dropdown-option w-full text-left px-4 py-2 text-sm transition-colors hover:bg-surface-hover flex items-center gap-2',
                              group.kind === 'tag' ? 'tag-option' : `${group.kind}-option truncate`,
                            ].join(' ')}
                            key={`${group.kind}-${value}`}
                          >
                            <span className="w-4 h-4 rounded border border-border flex items-center justify-center flex-shrink-0 check-box">
                              <svg className="w-3 h-3 text-surface hidden check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                            <span className="truncate">
                              {group.prefix}
                              {group.prefix ? ' ' : ''}
                              {label}
                            </span>
                          </button>
                        )
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>

              <div data-test="view-toggle" className="photo-nav-view-toggle inline-flex rounded-md border border-border p-0.5 bg-surface-elevated">
                <button
                  type="button"
                  data-view="grid"
                  data-umami-event="gallery_view_change"
                  data-umami-event-variant={variant}
                  data-umami-event-view="grid"
                  className="view-btn active flex items-center justify-center gap-1.5 h-8 px-3 rounded-md transition-[background-color,color,box-shadow]"
                  aria-label={`${gridLabel} view`}
                  aria-pressed="true"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="desktop-label text-sm lg:text-base font-medium">{gridLabel}</span>
                </button>
                <button
                  type="button"
                  data-view="list"
                  data-umami-event="gallery_view_change"
                  data-umami-event-variant={variant}
                  data-umami-event-view="list"
                  className="view-btn flex items-center justify-center gap-1.5 h-8 px-3 rounded-md transition-[background-color,color,box-shadow]"
                  aria-label={`${listLabel} view`}
                  aria-pressed="false"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className="desktop-label text-sm lg:text-base font-medium">{listLabel}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <div id="nav-placeholder" className="hidden h-9 md:h-10" />
    </div>
  )
}

export default function Gallery(props: GalleryProps) {
  const Behavior = props.variant === 'photos'
    ? PhotoGalleryBehavior
    : ArtGalleryBehavior
  return (
    <Behavior props={{}} hydrate="load">
      <GalleryToolbar {...props} />
    </Behavior>
  )
}
