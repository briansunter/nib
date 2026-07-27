import type { PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'
import TravelMap from '../../islands/travel-map'

export const meta = {
  title: 'Travel Map | Brian Sunter',
  description: 'Places I have been, collected on one map.',
}

export default function TravelMapPage({ collections }: PageProps<typeof config>) {
  const travel = collections.travel[0]?.data
  if (!travel) return null
  const cities = [...travel.cities].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">Where I have been</p>
        <h1>Travel Map</h1>
        <p className="lead">{travel.description}</p>
        <p className="project-count">
          {cities.length} cities · {travel.visitedCountries.length} countries · {travel.visitedUsStates.length} US states
        </p>
      </header>
      <section className="content-column">
        <p className="small-note">
          Explore the places on the map or use the accessible list below.
        </p>
        <TravelMap cities={cities} hydrate="load" />
        <div className="meta-row">
          {travel.visitedCountries.map((code) => <span className="tag" key={code}>{code}</span>)}
        </div>
        <ul className="travel-list">
          {cities.map((city) => (
            <li key={city.id}>
              <strong>{city.name}</strong>
              <span className="meta-row">
                <span>{city.countryCode}{city.stateCode ? ` · ${city.stateCode}` : ''}{city.provinceCode ? ` · ${city.provinceCode}` : ''}</span>
                <span>{city.gps.lat.toFixed(4)}, {city.gps.lng.toFixed(4)}</span>
                {city.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
