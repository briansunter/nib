import type { TravelMapPayload } from '../lib/travel/page-data'
import { TravelMapBehavior } from '../client-behaviors'

interface TravelStats {
  cityCount: number
  countryCount: number
  chinaProvinceCount: number
  usStateCount: number
}

export default function TravelMap({
  map,
  stats,
}: {
  map: TravelMapPayload
  stats: TravelStats
}) {
  return (
    <TravelMapBehavior props={{}} hydrate="load">
      <section className="travel-map-panel" aria-labelledby="travel-map-title">
        <h2 id="travel-map-title" className="sr-only">Visited places map</h2>
        <div
          id="travel-map"
          className="travel-map-canvas"
          data-travel-map={JSON.stringify(map)}
        >
          <div className="travel-map-loading" aria-hidden="true">Loading map</div>
        </div>
        <button
          type="button"
          className="travel-map-fullscreen-button"
          data-travel-map-fullscreen
          aria-controls="travel-map"
          aria-label="Enter fullscreen map"
          aria-pressed="false"
        >
        <svg
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          className="travel-map-fullscreen-icon"
          data-fullscreen-icon="enter"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M5 5h5v2H7v3H5zm9 0h5v5h-2V7h-3zm3 9h2v5h-5v-2h3zm-7 3v2H5v-5h2v3z" />
        </svg>
        <svg
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          className="travel-map-fullscreen-icon"
          data-fullscreen-icon="exit"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M14 14h5v2h-3v3h-2zm-9 0h5v5H8v-3H5zm3-9h2v5H5V8h3zm11 3v2h-5V5h2v3z" />
        </svg>
        </button>
        <div className="travel-map-meta" aria-hidden="true">
        <span>
          <strong>{stats.countryCount}</strong>
          {stats.countryCount === 1 ? 'country' : 'countries'}
        </span>
        <span>
          <strong>{stats.usStateCount}</strong>
          US {stats.usStateCount === 1 ? 'state' : 'states'}
        </span>
        <span>
          <strong>{stats.chinaProvinceCount}</strong>
          China {stats.chinaProvinceCount === 1 ? 'province' : 'provinces'}
        </span>
        <span>
          <strong>{stats.cityCount}</strong>
          {stats.cityCount === 1 ? 'city' : 'cities'}
        </span>
        </div>
      </section>
    </TravelMapBehavior>
  )
}
