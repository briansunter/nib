import { siteHref, type PageProps } from '@briansunter/nib'
import { Image } from '@briansunter/nib-images'
import type config from '../../../nib.config'
import Gallery from '../../islands/gallery'
import { galleryImages } from '../../data/gallery-images'
import { imageSizing } from '../../lib/image-sizing'

export const meta = {
  title: 'Art | Brian Sunter',
  description: 'Urban sketches, watercolor, and field drawings.',
}

function slugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function ArtPage({ collections }: PageProps<typeof config>) {
  const total = collections.art.reduce((count, collection) => count + collection.data.artworks.length, 0)
  const collectionOptions = collections.art.map((collection) => ({
    id: collection.id,
    name: collection.data.name,
    count: collection.data.artworks.length,
  }))
  const filters = [
    ...[...new Set(collections.art.flatMap((collection) => collection.data.artworks.map((artwork) => artwork.medium).filter(Boolean)))].sort().map((medium) => ({ kind: 'medium' as const, value: medium, label: medium })),
    ...[...new Set(collections.art.flatMap((collection) => collection.data.artworks.flatMap((artwork) => artwork.tags)))].sort().map((tag) => ({ kind: 'tag' as const, value: tag, label: `#${tag}` })),
  ]

  return (
    <div className="page-stack art-page">
      <header className="page-hero content-column">
        <p className="eyebrow">Studio notes</p>
        <h1>Art</h1>
        <p className="lead">Urban sketches, watercolor, and field drawings from San Francisco, Hawaii, and beyond.</p>
        <p className="project-count">{total} artworks</p>
      </header>
      <Gallery galleryId="art-gallery" variant="art" collections={collectionOptions} filters={filters} hydrate="load" />
      <div id="art-gallery" className="pswp-gallery art-gallery gallery grid-view content-column" data-view="grid">
        {collections.art.map((collection, collectionIndex) => (
          <section id={`collection-${collection.id}`} className="collection-section art-collection-section" data-collection={collection.id} key={collection.id}>
            {!collection.data.default && <h2 className="gallery-section__title">{collection.data.name}</h2>}
            {collection.data.description && collectionIndex === 0 && <p className="article-dek">{collection.data.description}</p>}
            <div className="art-items gallery-items">
              {collection.data.artworks.map((artwork, artIndex) => {
                const source = artwork.image ? galleryImages[artwork.image] : undefined
                const title = artwork.title || 'Untitled'
                const slug = `${collection.id}-${artIndex}-${slugPart(artwork.title || artwork.image || 'art')}`
                const year = artwork.date.slice(0, 4)
                const caption = [title, artwork.medium, year, artwork.dimensions, artwork.description].filter(Boolean).join(' — ')
                const width = source?.width ?? imageSizing.artCard.width
                const height = source?.height ?? Math.round(width * 1.25)
                return (
                  <article
                    className="photo-container art-item gallery-item"
                    data-collection={collection.id}
                    data-medium={artwork.medium}
                    data-tags={artwork.tags.join(',')}
                    data-gallery-slug={slug}
                    key={`${collection.id}-${artIndex}`}
                  >
                    <a className="art-item-link gallery-item-link" href={artwork.image ? siteHref(artwork.image) : '#'} data-gallery-slug={slug} data-pswp-width={width} data-pswp-height={height} data-caption={caption} aria-label={title} onClick={!artwork.image ? (event) => event.preventDefault() : undefined}>
                      {source ? (
                        <Image
                          src={source}
                          alt={title}
                          layout="constrained"
                          width={imageSizing.artCard.width}
                          maxWidth={imageSizing.artCard.width}
                          widths={imageSizing.artCard.widths.split(',').map(Number)}
                          sizes={imageSizing.artCard.sizes}
                          loading={collectionIndex === 0 && artIndex < 2 ? 'eager' : 'lazy'}
                          fetchPriority={collectionIndex === 0 && artIndex < 2 ? 'high' : 'auto'}
                          quality={80}
                          className="art-item-image"
                        />
                      ) : <span className="gradient-placeholder" aria-hidden="true" />}
                      <div className="art-item-overlay gallery-item-overlay" aria-hidden="true">
                        <div className="gallery-item-overlay-inner">
                          <h3>{title}</h3>
                          <p>{[artwork.medium, year, artwork.dimensions].filter(Boolean).join(' · ')}</p>
                          {artwork.description && <p>{artwork.description}</p>}
                        </div>
                      </div>
                    </a>
                    <div className="art-item-meta">
                      <h3>{title}</h3>
                      <p>{[artwork.medium, year, artwork.dimensions].filter(Boolean).join(' · ')}</p>
                      {artwork.description && <p>{artwork.description}</p>}
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
