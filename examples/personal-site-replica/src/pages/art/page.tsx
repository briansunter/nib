import { Image } from '@briansunter/nib-images'
import { siteHref } from '@briansunter/nib'
import { imageMap } from '../../data/images'

export const meta = {
  title: 'Art',
  description: 'Field drawings, watercolor, and visual notes.',
}

const artwork = [
  { title: 'Baby Tern', medium: 'Watercolor', image: imageMap.babyTern },
  { title: 'Campfire Grill', medium: 'Pen and ink', image: imageMap.campingGrill },
  { title: 'Conservatory', medium: 'Watercolor', image: imageMap.conservatory },
  { title: 'Homa Plant', medium: 'Watercolor', image: imageMap.homaPlant },
  { title: 'Waikiki Outrigger', medium: 'Field drawing', image: imageMap.waikikiOutrigger },
]

export default function ArtPage() {
  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">Studio notes</p>
        <h1>Art</h1>
        <p className="lead">A small gallery of sketches and studies. Nib keeps the gallery static and lets each local raster source produce responsive variants.</p>
      </header>
      <section className="gallery content-column" aria-label="Artwork gallery">
        {artwork.map((piece, index) => (
          <figure className="gallery-item" key={piece.title}>
            <a href={siteHref('/art')} aria-label={`View ${piece.title}`}>
              {index === 0 ? (
                <Image src={piece.image} alt={piece.title} layout="constrained" width={720} maxWidth={960} widths={[320, 480, 720]} sizes="(min-width: 900px) 33vw, 100vw" priority className="gallery-image" />
              ) : (
                <Image src={piece.image} alt={piece.title} layout="constrained" width={720} maxWidth={960} widths={[320, 480, 720]} sizes="(min-width: 900px) 33vw, 100vw" loading="lazy" className="gallery-image" />
              )}
            </a>
            <figcaption><strong>{piece.title}</strong><span>{piece.medium}</span></figcaption>
          </figure>
        ))}
      </section>
    </div>
  )
}
