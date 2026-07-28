import type { CSSProperties } from 'react'
import { siteHref, type PageProps } from '@briansunter/nib'
import { Image } from '@briansunter/nib-images'
import type config from '../../../nib.config'
import Gallery from '../../islands/gallery'
import { galleryImages } from '../../data/gallery-images'

export const meta = {
  title: 'Photos | Brian Sunter',
  description: 'Travel and landscape photo collections, organized by location and trip.',
}

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const fullDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s/\\_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function gallerySlug(collectionId: string, label: string | undefined, index: number): string {
  return `${slugify(collectionId) || 'gallery'}-${label ? slugify(label) : 'photo'}-${index + 1}`
}

function responsiveWidths(width: number): number[] {
  const widths = [480, 800, 1200].filter((candidate) => candidate <= width)
  return widths.length > 0 ? widths : [width]
}

export default function PhotosPage({ collections }: PageProps<typeof config>) {
  const groups = [...collections.photos]
    .map((collection) => ({
      ...collection,
      date: new Date(`${collection.data.date}T00:00:00.000Z`),
      photos: collection.data.photos.map((photo, index) => ({
        ...photo,
        tags: [...new Set([...collection.data.tags, ...photo.tags])],
        slug: gallerySlug(collection.id, photo.title, index),
      })),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
  const total = groups.reduce((count, collection) => count + collection.photos.length, 0)
  const locations = [...new Set(groups.map((collection) => collection.data.location))].sort()
  const tags = [...new Set(groups.flatMap((collection) => collection.photos.flatMap((photo) => photo.tags)))].sort()

  return (
    <div className="photos-replica">
      <Gallery
        variant="photos"
        collections={groups.map((collection) => ({
          id: collection.id,
          name: collection.data.name,
          count: collection.photos.length,
        }))}
        filterGroups={[
          { label: 'Locations', values: locations.map((value) => ({ value, label: value })), kind: 'location', prefix: '', maxItems: locations.length },
          { label: 'Tags', values: tags.map((value) => ({ value, label: value })), kind: 'tag', prefix: '#', maxItems: 15 },
        ]}
        filterAriaLabel="Filter photos"
        gridLabel="Grid"
        listLabel="List"
        hydrate="load"
      />

      <div className="photos-container pt-8 sm:pt-12 pb-6 sm:pb-8">
        <header className="page-hero mb-0">
          <h1 className="page-hero-title">Photos</h1>
          <div className="page-hero-rule" aria-hidden="true" />
          <p className="page-hero-dek">
            Travel and landscape photo collections, organized by location and trip.
            <span className="block mt-2 font-sans text-base md:text-lg">
              <span id="visible-count" className="font-semibold text-ink tabular-nums">{total}</span> photos.
            </span>
          </p>
        </header>
      </div>

      <div className="photos-container pb-6">
        <div className="pswp-gallery photo-gallery gallery grid-view mt-5 md:mt-8" data-view="grid">
          {groups.map((collection, collectionIndex) => {
            const dateTime = collection.date.toISOString()
            return (
              <section id={collection.id} className="collection-section scroll-mt-16 md:scroll-mt-20" key={collection.id}>
                {collectionIndex > 0 && (
                  <div className="pt-8 md:pt-16 mb-6 md:mb-12">
                    <hr className="border-t border-border" />
                  </div>
                )}

                <header className="mb-1.5 md:mb-4">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-8">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl md:text-3xl lg:text-4xl font-semibold tracking-tight text-ink">
                        {collection.data.name}
                      </h2>
                      {collection.data.description && (
                        <p className="mt-2 md:mt-3 font-serif text-sm md:text-lg text-ink-secondary leading-relaxed max-w-2xl">
                          {collection.data.description}
                        </p>
                      )}
                      <div className="mt-2.5 md:mt-4 flex flex-wrap items-center gap-x-3 md:gap-x-4 gap-y-1.5 md:gap-y-2 text-xs md:text-sm font-sans text-ink-muted">
                        <span className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          {collection.data.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                          </svg>
                          {monthFormatter.format(collection.date)}
                        </span>
                        <span className="flex items-center gap-1 tabular-nums">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                          {collection.photos.length} {collection.photos.length === 1 ? 'photo' : 'photos'}
                        </span>
                      </div>
                    </div>

                    {collection.data.gps && (
                      <div className="flex-shrink-0 w-full md:w-[calc(33.333%-0.667rem)] aspect-photo">
                        <div
                          id={`map-${collection.id}`}
                          className="map-element collection-map w-full h-full overflow-hidden border border-border hover:bg-surface-hover transition-colors duration-200 cursor-pointer"
                          data-id={`map-${collection.id}`}
                          data-lat={collection.data.gps.lat}
                          data-lng={collection.data.gps.lng}
                          title={`View ${collection.data.location} on map`}
                          role="region"
                          aria-label={`Interactive map of ${collection.data.location}. Map tiles load when this section approaches the viewport.`}
                        />
                      </div>
                    )}
                  </div>
                </header>

                <div className="photo-grid-container">
                  <div className="photo-items gallery-items">
                    {collection.photos.map((photo, photoIndex) => {
                      const source = photo.image ? galleryImages[photo.image] : undefined
                      const width = source?.width ?? 1200
                      const height = source?.height ?? 900
                      const ratio = height / width
                      const fullDate = fullDateFormatter.format(collection.date)
                      const title = photo.title || photo.description || `${collection.data.location}, ${fullDate}`
                      return (
                        <article
                          className="photo-container photo-item gallery-item"
                          data-location={collection.data.location}
                          data-collection={collection.data.name}
                          data-tags={photo.tags.join(',')}
                          data-gallery-slug={photo.slug}
                          data-photo-index={photoIndex}
                          data-photo-height-ratio={ratio}
                          style={{
                            '--photo-order': photoIndex,
                            '--photo-detail-aspect-ratio': ratio,
                          } as CSSProperties}
                          key={photo.slug}
                        >
                          <a
                            href={photo.image ? siteHref(photo.image) : '#'}
                            data-astro-prefetch="false"
                            data-pswp-width={width}
                            data-pswp-height={height}
                            data-gallery-slug={photo.slug}
                            className="photo-item-link gallery-item-link group"
                            aria-label={`Open ${title}`}
                          >
                            {source ? (
                              <Image
                                src={source}
                                alt={title}
                                layout="constrained"
                                width={width}
                                maxWidth={width}
                                widths={responsiveWidths(width)}
                                sizes="auto, (min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                                loading={collectionIndex === 0 && photoIndex === 0 ? 'eager' : 'lazy'}
                                fetchPriority={collectionIndex === 0 && photoIndex === 0 ? 'high' : 'auto'}
                                quality={75}
                                className="photo-item-image"
                              />
                            ) : <span className="gradient-placeholder" aria-hidden="true" />}
                            <div className="photo-item-overlay gallery-item-overlay" aria-hidden="true">
                              <div className="photo-item-overlay-inner gallery-item-overlay-inner">
                                {photo.title && <h3 className="photo-item-overlay-title" data-photo-title>{photo.title}</h3>}
                                {photo.description && <p className="photo-item-overlay-description" data-photo-description>{photo.description}</p>}
                                <div className="photo-item-overlay-meta">
                                  <span data-photo-location>{collection.data.location}</span>
                                  <span className="photo-item-overlay-sep" aria-hidden="true">·</span>
                                  <time dateTime={dateTime} className="tabular-nums" data-photo-date>{shortDateFormatter.format(collection.date)}</time>
                                </div>
                              </div>
                            </div>
                          </a>

                          <div className="photo-detail-meta">
                            {photo.title && <h3 className="photo-detail-title">{photo.title}</h3>}
                            {photo.description && <p className="photo-detail-description">{photo.description}</p>}
                            <div className="photo-detail-facts">
                              <span>{collection.data.location}</span>
                              <span aria-hidden="true">·</span>
                              <time dateTime={dateTime}>{fullDate}</time>
                            </div>
                            {photo.tags.length > 0 && (
                              <div className="photo-detail-tags">
                                {photo.tags.slice(0, 5).map((tag) => <span key={tag}>#{tag}</span>)}
                              </div>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
