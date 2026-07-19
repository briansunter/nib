import { Image } from '@briansunter/nib-images'
import { siteHref } from '@briansunter/nib'
import { imageMap } from '../../data/images'

export const meta = {
  title: 'Photos',
  description: 'A responsive sample from the travel photo archive.',
}

const photos = [
  { title: 'Electric Beach', location: 'Oahu, Hawaii', image: imageMap.electricBeach },
  { title: 'Electric Beach Cove', location: 'Oahu, Hawaii', image: imageMap.electricBeachCove },
  { title: 'Hanauma Bay', location: 'Oahu, Hawaii', image: imageMap.hanaumaBay },
]

export default function PhotosPage() {
  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">Travel archive</p>
        <h1>Photos</h1>
        <p className="lead">A few images from the target site’s larger collection. The full map, EXIF browser, and lightbox are intentionally outside this proof.</p>
      </header>
      <section className="photo-grid content-column" aria-label="Photo gallery">
        {photos.map((photo, index) => (
          <figure className="photo-card" key={photo.title}>
            <a href={siteHref('/photos')} aria-label={`View ${photo.title}`}>
              {index === 0 ? (
                <Image src={photo.image} alt={photo.title} layout="full" maxWidth={960} widths={[480, 720, 960]} sizes="(min-width: 900px) 50vw, 100vw" priority className="photo-image" />
              ) : (
                <Image src={photo.image} alt={photo.title} layout="full" maxWidth={960} widths={[480, 720, 960]} sizes="(min-width: 900px) 50vw, 100vw" loading="lazy" className="photo-image" />
              )}
            </a>
            <figcaption><strong>{photo.title}</strong><span>{photo.location}</span></figcaption>
          </figure>
        ))}
      </section>
    </div>
  )
}
