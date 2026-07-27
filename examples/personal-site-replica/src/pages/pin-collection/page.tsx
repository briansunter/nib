import { siteHref, type PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'
import { imageSizing } from '../../lib/image-sizing'
import PinFilter from '../../islands/pin-filter'

export const meta = {
  title: 'Pin Collection | Brian Sunter',
  description: 'A lapel pin collection gathered from travels, events, and online finds.',
}

export default function PinCollectionPage({ collections }: PageProps<typeof config>) {
  const collection = collections.pins[0]?.data
  if (!collection) return null
  // One unified list, favorite-first then by name. The client island reorders
  // this same list for filtering/sorting; the SSR order is the initial paint.
  const pins = [...collection.pins].sort(
    (a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name),
  )
  const categories = [...new Set(pins.map((pin) => pin.category).filter(Boolean))].sort()
  const tags = [...new Set(pins.flatMap((pin) => pin.tags))].sort()

  return (
    <div className="page-stack pin-page">
      <header className="page-hero content-column">
        <p className="eyebrow">{collection.name}</p>
        <h1>Pin Collection <span className="pin-count">{pins.length}</span></h1>
        <p className="lead">{collection.description}</p>
        <p className="project-count">{pins.length} pins · {categories.length} categories</p>
      </header>
      <section className="content-column">
        <div className="meta-row">{categories.map((category) => <span className="tag" key={category}>{category}</span>)}</div>
        {/* The island owns filter/sort/modal state; only the small category/tag
            control lists and the grid/dialog ids cross the SSR boundary. */}
        <PinFilter categories={categories} tags={tags} gridId="pin-grid" />
        <ul className="pin-grid" id="pin-grid" aria-label="Pin collection">
          {pins.map((pin, index) => {
            const search = [pin.name, pin.description, pin.category, pin.acquiredAt, pin.tags.join(' ')]
              .join(' ').toLowerCase()
            return (
              <li
                key={pin.id}
                className={`pin-card${pin.favorite ? ' pin-card--favorite' : ''}`}
                data-pin-id={pin.id}
                data-name={pin.name}
                data-category={pin.category}
                data-tags={pin.tags.join(',')}
                data-favorite={String(pin.favorite)}
                data-description={pin.description}
                data-maker={pin.maker}
                data-acquired={pin.acquiredAt}
                data-image={pin.image ? siteHref(pin.image) : ''}
                data-search={search}
                data-index={index}
              >
                <button
                  type="button"
                  className="pin-card__trigger"
                  data-pin-trigger
                  aria-haspopup="dialog"
                  aria-label={`View details for ${pin.name}`}
                >
                  {pin.image ? (
                    <img
                      src={siteHref(pin.image)}
                      alt={`${pin.name} enamel pin`}
                      width={imageSizing.pinCard.width}
                      sizes={imageSizing.pinCard.sizes}
                      data-nib-width={imageSizing.pinCard.width}
                      data-nib-widths={imageSizing.pinCard.widths}
                      loading="lazy"
                      decoding="async"
                      className="pin-image"
                    />
                  ) : <span className="gradient-placeholder" aria-hidden="true" />}
                  <strong className="pin-card__name">{pin.name}</strong>
                  {pin.description && <span className="pin-card__description">{pin.description}</span>}
                  <span className="meta-row pin-card__meta">
                    <span>{pin.category}</span>
                    {pin.acquiredAt && <span>{pin.acquiredAt}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      <p className="small-note content-column">The pin grid is server-rendered; the filter island only reorders and toggles these cards and never receives the full collection.</p>
    </div>
  )
}
