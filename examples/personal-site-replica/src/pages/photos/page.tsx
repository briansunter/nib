import { siteHref, type PageProps } from '@briansunter/nib'
import { Image } from '@briansunter/nib-images'
import type config from '../../../nib.config'
import Gallery from '../../islands/gallery'
import { galleryImages } from '../../data/gallery-images'
import { imageSizing } from '../../lib/image-sizing'

export const meta = {
  title: 'Photos | Brian Sunter',
  description: 'Travel photo collections from Hawaii, London, and Los Angeles.',
}

function slugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function PhotosPage({ collections }: PageProps<typeof config>) {
  const total = collections.photos.reduce((count, collection) => count + collection.data.photos.length, 0)
  const collectionOptions = collections.photos.map((collection) => ({
    id: collection.id,
    name: collection.data.name,
    count: collection.data.photos.length,
  }))
  const filters = [
    ...collections.photos.map((collection) => ({ kind: 'location' as const, value: collection.data.location, label: collection.data.location })).filter((entry) => entry.value),
    ...[...new Set(collections.photos.flatMap((collection) => collection.data.photos.flatMap((photo) => photo.tags)))].sort().map((tag) => ({ kind: 'tag' as const, value: tag, label: `#${tag}` })),
  ]

  return (
    <div className="page-stack photos-page">
      <header className="page-hero content-column">
        <p className="eyebrow">Travel archive</p>
        <h1>Photos</h1>
        <p className="lead">Photo collections grouped by trip.</p>
        <p className="project-count">{total} photos</p>
      </header>
      <Gallery galleryId="photos-gallery" variant="photos" collections={collectionOptions} filters={filters} hydrate="load" />
      <div id="photos-gallery" className="pswp-gallery photo-gallery gallery grid-view content-column" data-view="grid">
        {collections.photos.map((collection, collectionIndex) => (
          <section id={`collection-${collection.id}`} className="collection-section gallery-section" data-collection={collection.id} key={collection.id}>
            <header className="collection-section__header">
              <div>
                <h2 className="gallery-section__title">{collection.data.name}</h2>
                {collection.data.description && <p className="article-dek">{collection.data.description}</p>}
                {collection.data.location && <p className="collection-section__meta">{collection.data.location} <span aria-hidden="true">·</span> {collection.data.photos.length} photos</p>}
              </div>
            </header>
            <div className="photo-items gallery-items">
              {collection.data.photos.map((photo, photoIndex) => {
                const source = photo.image ? galleryImages[photo.image] : undefined
                const sizing = imageSizing.photoCard
                const title = photo.title || photo.description || 'Travel photo'
                const slug = `${collection.id}-${photoIndex}-${slugPart(photo.title || photo.image || 'photo')}`
                const caption = [photo.title, photo.description, collection.data.location].filter(Boolean).join(' — ')
                const width = source?.width ?? sizing.width
                const height = source?.height ?? Math.round(width * 0.75)
                return (
                  <article
                    className="photo-container photo-item gallery-item"
                    data-collection={collection.id}
                    data-location={collection.data.location}
                    data-tags={photo.tags.join(',')}
                    data-gallery-slug={slug}
                    key={`${collection.id}-${photoIndex}`}
                  >
                    <a
                      className="photo-item-link gallery-item-link"
                      href={photo.image ? siteHref(photo.image) : '#'}
                      data-gallery-slug={slug}
                      data-pswp-width={width}
                      data-pswp-height={height}
                      data-caption={caption}
                      aria-label={`Open ${title}`}
                      onClick={!photo.image ? (event) => event.preventDefault() : undefined}
                    >
                      {source ? (
                        <Image
                          src={source}
                          alt={title}
                          layout="constrained"
                          width={sizing.width}
                          maxWidth={sizing.width}
                          widths={sizing.widths.split(',').map(Number)}
                          sizes={sizing.sizes}
                          loading={collectionIndex === 0 && photoIndex === 0 ? 'eager' : 'lazy'}
                          fetchPriority={collectionIndex === 0 && photoIndex === 0 ? 'high' : 'auto'}
                          quality={75}
                          className="photo-item-image"
                        />
                      ) : <span className="gradient-placeholder" aria-hidden="true" />}
                      <div className="photo-item-overlay gallery-item-overlay" aria-hidden="true">
                        <div className="gallery-item-overlay-inner">
                          {photo.title && <h3>{photo.title}</h3>}
                          {photo.description && <p>{photo.description}</p>}
                          <p>{collection.data.location}</p>
                        </div>
                      </div>
                    </a>
                    <div className="photo-detail-meta">
                      {photo.title && <h3>{photo.title}</h3>}
                      {photo.description && <p>{photo.description}</p>}
                      {photo.tags.length > 0 && <p className="photo-detail-tags">{photo.tags.map((tag) => `#${tag}`).join(' ')}</p>}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
