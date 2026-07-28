import type { CSSProperties } from 'react'
import { siteHref, type PageProps } from '@briansunter/nib'
import { Image } from '@briansunter/nib-images'
import type config from '../../../nib.config'
import Gallery from '../../islands/gallery'
import { galleryImages } from '../../data/gallery-images'

export const meta = {
  title: 'Art | Brian Sunter',
  description: 'Studies and finished pieces across pen and ink, charcoal, watercolor, graphite, and digital work.',
}

const KNOWN_MEDIUMS = new Set([
  'acrylic',
  'charcoal',
  'colored-pencil',
  'digital',
  'gouache',
  'graphite',
  'ink',
  'marker',
  'mixed-media',
  'oil',
  'pastel',
  'pen-and-ink',
  'pencil',
  'watercolor',
])
const MINOR_WORDS = new Set(['and', 'or', 'of', 'the', 'in', 'on', 'with'])

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s/\\_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function prettify(value: string): string {
  return value.split('-').map((word, index) => (
    index > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)
  )).join(' ')
}

function responsiveWidths(width: number): number[] {
  const widths = [480, 800, 1200].filter((candidate) => candidate <= width)
  return widths.length > 0 ? widths : [width]
}

export default function ArtPage({ collections }: PageProps<typeof config>) {
  const groups = [...collections.art]
    .map((collection) => {
      const collectionDate = new Date(`${collection.data.date}T00:00:00.000Z`)
      const collectionTags = collection.data.tags
      return {
        ...collection,
        date: collectionDate,
        artworks: collection.data.artworks
          .map((artwork, index) => {
            const date = artwork.date ? new Date(`${artwork.date}T00:00:00.000Z`) : collectionDate
            const medium = artwork.medium || collection.data.medium || 'Mixed media'
            const mediumSlug = slugify(medium)
            return {
              ...artwork,
              date,
              medium,
              mediumSlug,
              tags: [...new Set([...collectionTags, ...artwork.tags, mediumSlug])],
              slug: `${slugify(collection.id) || 'gallery'}-${artwork.title ? slugify(artwork.title) : 'artwork'}-${index + 1}`,
            }
          })
          .sort((a, b) => b.date.getTime() - a.date.getTime()),
      }
    })
    .sort((a, b) => {
      if (a.data.default !== b.data.default) return a.data.default ? -1 : 1
      return b.date.getTime() - a.date.getTime()
    })
  const total = groups.reduce((count, collection) => count + collection.artworks.length, 0)
  const mediums = [...new Set(groups.flatMap((group) => group.artworks.map((artwork) => artwork.mediumSlug)))]
    .filter((medium) => KNOWN_MEDIUMS.has(medium))
    .sort()
  const tags = [...new Set(groups.flatMap((group) => group.artworks.flatMap((artwork) => artwork.tags)))]
    .filter((tag) => !KNOWN_MEDIUMS.has(tag))
    .sort()

  return (
    <div className="art-replica">
      {total > 0 && (
        <Gallery
          variant="art"
          collections={groups.map((collection) => ({
            id: collection.id,
            name: collection.data.name,
            count: collection.artworks.length,
          }))}
          filterGroups={[
            { label: 'Mediums', values: mediums.map((medium) => ({ value: medium, label: prettify(medium) })), kind: 'medium', prefix: '', maxItems: mediums.length },
            { label: 'Tags', values: tags.map((value) => ({ value, label: value })), kind: 'tag', prefix: '#', maxItems: 18 },
          ]}
          filterAriaLabel="Filter artwork"
          gridLabel="Gallery"
          listLabel="Detail"
          hydrate="load"
        />
      )}

      <div className="art-index">
        <div className="art-container pt-10 sm:pt-16 md:pt-20">
          <header className="page-hero">
            <h1 className="page-hero-title">Art</h1>
            <div className="page-hero-rule" aria-hidden="true" />
            <p className="page-hero-dek">
              Studies and finished pieces across pen and ink, charcoal, watercolor, graphite, and digital work.
              <span className="block mt-2 font-sans text-base md:text-lg">
                <span id="visible-count" className="font-semibold text-ink tabular-nums">{total}</span> {total === 1 ? 'piece' : 'pieces'}.
              </span>
            </p>
          </header>

          {total > 0 ? (
            <div className="pswp-gallery art-gallery gallery" data-view="grid">
              {groups.map((collection, collectionIndex) => (
                <section
                  id={collection.id}
                  className="collection-section art-collection-section scroll-mt-20"
                  data-first={collectionIndex === 0 ? 'true' : 'false'}
                  data-default={collection.data.default ? 'true' : 'false'}
                  key={collection.id}
                >
                  {groups.length > 1 && !collection.data.default && (
                    <header className="art-collection-header">
                      <h2 className="art-collection-name">{collection.data.name}</h2>
                      <p className="art-collection-meta">
                        <span><span className="tabular-nums">{collection.artworks.length}</span> {collection.artworks.length === 1 ? 'piece' : 'pieces'}</span>
                        <span className="art-collection-meta-sep" aria-hidden="true">·</span>
                        <time dateTime={collection.date.toISOString()}>{collection.date.getFullYear()}</time>
                      </p>
                    </header>
                  )}

                  <div className="art-items gallery-items">
                    {collection.artworks.map((artwork, artIndex) => {
                      const source = artwork.image ? galleryImages[artwork.image] : undefined
                      const width = source?.width ?? 1200
                      const height = source?.height ?? 1500
                      const ratio = height / width
                      const title = artwork.title || 'Untitled'
                      const year = String(artwork.date.getFullYear())
                      const tagsWithoutMedium = artwork.tags.filter((tag) => tag !== artwork.mediumSlug)
                      return (
                        <article
                          className="photo-container art-item gallery-item"
                          data-medium={artwork.mediumSlug}
                          data-collection={collection.data.name}
                          data-tags={tagsWithoutMedium.join(',')}
                          data-gallery-slug={artwork.slug}
                          data-art-index={artIndex}
                          data-art-height-ratio={ratio}
                          style={{
                            '--art-order': artIndex,
                            '--art-detail-aspect-ratio': ratio,
                          } as CSSProperties}
                          key={artwork.slug}
                        >
                          <span data-photo-title className="sr-only">{title}</span>
                          <span data-photo-medium className="sr-only">{artwork.medium}</span>
                          <span data-photo-date className="sr-only">{year}</span>
                          <span data-photo-collection className="sr-only">{collection.data.name}</span>
                          <span data-photo-description className="sr-only">{artwork.description}</span>
                          {artwork.dimensions && <span data-photo-dimensions className="sr-only">{artwork.dimensions}</span>}
                          {artwork.surface && <span data-photo-surface className="sr-only">{artwork.surface}</span>}

                          <a
                            href={artwork.image ? siteHref(artwork.image) : '#'}
                            data-astro-prefetch="false"
                            data-pswp-width={width}
                            data-pswp-height={height}
                            data-gallery-slug={artwork.slug}
                            className="art-item-link gallery-item-link"
                            aria-label={title}
                          >
                            {source ? (
                              <Image
                                src={source}
                                alt={artwork.title || artwork.description || 'Artwork'}
                                layout="constrained"
                                width={width}
                                maxWidth={width}
                                widths={responsiveWidths(width)}
                                sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                                loading={artIndex < 2 ? 'eager' : 'lazy'}
                                fetchPriority={artIndex < 2 ? 'high' : 'auto'}
                                quality={80}
                                className="art-item-image"
                              />
                            ) : <span className="gradient-placeholder" aria-hidden="true" />}

                            <div className="art-item-overlay gallery-item-overlay" aria-hidden="true">
                              <div className="art-item-overlay-inner gallery-item-overlay-inner">
                                <h3 className="art-item-overlay-title">{title}</h3>
                                <p className="art-item-overlay-line">
                                  <span>{artwork.medium}</span>
                                  <span className="art-item-overlay-sep" aria-hidden="true">·</span>
                                  <time dateTime={artwork.date.toISOString()}>{year}</time>
                                  {artwork.dimensions && (
                                    <>
                                      <span className="art-item-overlay-sep" aria-hidden="true">·</span>
                                      <span>{artwork.dimensions}</span>
                                    </>
                                  )}
                                </p>
                                {artwork.location && <p className="art-item-overlay-location">{artwork.location}</p>}
                                {artwork.description && <p className="art-item-overlay-description">{artwork.description}</p>}
                              </div>
                            </div>
                          </a>

                          <div className="art-item-meta">
                            <h3 className="art-item-title">{title}</h3>
                            <p className="art-item-line">
                              <span>{artwork.medium}</span>
                              <span className="art-item-sep" aria-hidden="true">·</span>
                              <time dateTime={artwork.date.toISOString()}>{year}</time>
                              {artwork.dimensions && (
                                <>
                                  <span className="art-item-sep" aria-hidden="true">·</span>
                                  <span>{artwork.dimensions}</span>
                                </>
                              )}
                            </p>
                            {artwork.location && <p className="art-item-location">{artwork.location}</p>}
                            {artwork.description && <p className="art-item-description">{artwork.description}</p>}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <section className="max-w-3xl border-t border-border pt-8 md:pt-12">
              <h2 className="font-sans text-xl md:text-2xl font-semibold tracking-tight text-ink">Sketchbook in progress</h2>
              <p className="mt-3 font-serif text-base md:text-lg leading-relaxed text-ink-secondary">
                I am collecting sketches, studies, and finished pieces here.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
