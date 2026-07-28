import type { PageProps } from '@briansunter/nib'
import type config from '../../../nib.config'
import { PageHero } from '../../components/PageHero'
import TravelMap from '../../components/TravelMap'
import { getTravelPageData } from '../../lib/travel/page-data'

export const meta = {
  title: 'Travel Map | Brian Sunter',
  description: 'Places I have been, from quick city stops to longer trips, collected on one map.',
}

export default function TravelMapPage({ collections }: PageProps<typeof config>) {
  const travelData = getTravelPageData(collections.travel[0]?.data)
  const subdivisionSummaries = [
    ...travelData.usStates.map((state) => ({
      name: state.name,
      kind: 'US state',
      cityCount: state.cityCount,
    })),
    ...travelData.chinaProvinces.map((province) => ({
      name: province.name,
      kind: 'China province',
      cityCount: province.cityCount,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="travel-page travel-container py-8 sm:py-12 lg:py-16">
      <PageHero title={travelData.collectionName}>
        {travelData.collectionDescription}
      </PageHero>

      <div className="travel-stat-row" aria-label="Travel map totals">
        <span className="travel-stat">
          <strong>{travelData.stats.countryCount}</strong>
          {' '}
          {travelData.stats.countryCount === 1 ? 'country' : 'countries'}
        </span>{' '}
        <span className="travel-stat">
          <strong>{travelData.stats.usStateCount}</strong>
          {' '}
          US {travelData.stats.usStateCount === 1 ? 'state' : 'states'}
        </span>{' '}
        <span className="travel-stat">
          <strong>{travelData.stats.chinaProvinceCount}</strong>
          {' '}
          China {travelData.stats.chinaProvinceCount === 1 ? 'province' : 'provinces'}
        </span>{' '}
        <span className="travel-stat">
          <strong>{travelData.stats.cityCount}</strong>
          {' '}
          {travelData.stats.cityCount === 1 ? 'city' : 'cities'}
        </span>
      </div>

      <div className="mt-8 sm:mt-10">
        <TravelMap map={travelData.map} stats={travelData.stats} />
      </div>

      <div className="travel-visited-grid">
        <section
          className="travel-visited-section"
          aria-labelledby="visited-countries-title"
        >
          <div className="travel-section-heading">
            <h2 id="visited-countries-title" className="travel-section-title">
              Visited Countries
            </h2>
            <p className="travel-section-summary">
              Includes visits without a city entry.
            </p>
          </div>
          <ul className="travel-visited-list">
            {travelData.countries.map((country) => (
              <li key={country.code}>
                <span className="travel-visited-name">{country.name}</span>{' '}
                <span className="travel-visited-meta">
                  {country.cityCount > 0
                    ? `${country.cityCount} logged ${country.cityCount === 1 ? 'city' : 'cities'}`
                    : 'Visited, no city logged'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="travel-visited-section"
          aria-labelledby="visited-subdivisions-title"
        >
          <div className="travel-section-heading">
            <h2 id="visited-subdivisions-title" className="travel-section-title">
              Visited States and Provinces
            </h2>
            <p className="travel-section-summary">
              US states and China provinces, including visits without a city entry.
            </p>
          </div>
          <ul className="travel-visited-list">
            {subdivisionSummaries.map((subdivision) => (
              <li key={`${subdivision.kind}-${subdivision.name}`}>
                <span className="travel-visited-name">{subdivision.name}</span>{' '}
                <span className="travel-visited-meta">
                  {subdivision.kind} ·{' '}
                  {subdivision.cityCount > 0
                    ? `${subdivision.cityCount} logged ${subdivision.cityCount === 1 ? 'city' : 'cities'}`
                    : 'visited, no city logged'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="travel-city-section" aria-labelledby="travel-cities-title">
        <div className="travel-section-heading">
          <h2 id="travel-cities-title" className="travel-section-title">
            Visited Cities
          </h2>
          <p className="travel-section-summary">
            {travelData.stats.cityCount}
            {travelData.stats.cityCount === 1 ? ' city' : ' cities'} across{' '}
            {travelData.cityRegionGroups.length}
            {travelData.cityRegionGroups.length === 1 ? ' region' : ' regions'}
          </p>
        </div>
        <div className="travel-region-list">
          {travelData.cityRegionGroups.map((region) => (
            <section
              className="travel-region-group"
              aria-labelledby={`travel-region-${region.slug}`}
              key={region.slug}
            >
              <header className="travel-region-heading">
                <h3 id={`travel-region-${region.slug}`}>
                  {region.name}
                </h3>
                <p>
                  {region.cityCount}
                  {region.cityCount === 1 ? ' city' : ' cities'} ·{' '}
                  {region.countries.length}
                  {region.countries.length === 1 ? ' country' : ' countries'}
                </p>
              </header>
              <div className="travel-country-list">
                {region.countries.map((country) => (
                  <article
                    className={[
                      'travel-country-row',
                      country.subdivisionGroups.length > 0 && 'is-state-indexed',
                    ].filter(Boolean).join(' ')}
                    key={country.code}
                  >
                    <div className="travel-country-meta">
                      <h4>{country.name}</h4>
                      <p>
                        {country.cityCount}
                        {country.cityCount === 1 ? ' city' : ' cities'}
                        {country.subdivisionLabel &&
                          ` · ${country.subdivisionGroups.length} ${country.subdivisionLabel}${country.subdivisionGroups.length === 1 ? '' : 's'}`}
                      </p>
                    </div>
                    {country.subdivisionGroups.length > 0 ? (
                      <div
                        className="travel-state-list"
                        aria-label={`${country.name} cities by ${country.subdivisionLabel}`}
                      >
                        {country.subdivisionGroups.map((subdivision) => (
                          <article
                            className="travel-state-row"
                            id={subdivision.id}
                            key={subdivision.id}
                          >
                            <div className="travel-state-meta">
                              <h5>{subdivision.label}</h5>
                              {subdivision.meta && <p>{subdivision.meta}</p>}
                            </div>
                            <p
                              className="travel-city-line is-compact"
                              aria-label={`${subdivision.label} cities`}
                            >
                              {subdivision.cityNames}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p
                        className="travel-city-line"
                        aria-label={`${country.name} cities`}
                      >
                        {country.cityList}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}
