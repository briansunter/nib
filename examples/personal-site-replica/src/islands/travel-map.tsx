import { useEffect } from 'react'
import { defineIsland } from '@briansunter/nib'
import 'leaflet/dist/leaflet.css'

interface TravelCity { id: string; name: string; countryCode: string; stateCode?: string; provinceCode?: string; gps: { lat: number; lng: number } }

function TravelMap({ cities }: { cities: TravelCity[] }) {
  useEffect(() => {
    let map: any
    let cancelled = false
    const setup = async () => {
      const element = document.getElementById('travel-map-canvas')
      if (!element) return
      const module = await import('leaflet')
      if (cancelled) return
      const L = module.default ?? module
      map = L.map(element, { scrollWheelZoom: false }).setView([25, -20], 2)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 18 }).addTo(map)
      for (const city of cities) {
        L.circleMarker([city.gps.lat, city.gps.lng], { radius: 6, color: '#d97757', fillColor: '#d97757', fillOpacity: .9, weight: 2 })
          .addTo(map)
          .bindPopup(`<strong>${city.name}</strong><br>${city.countryCode}${city.stateCode ? ` · ${city.stateCode}` : ''}`)
      }
      window.setTimeout(() => map?.invalidateSize(), 0)
    }
    void setup()
    return () => { cancelled = true; map?.remove() }
  }, [cities])

  return <div className="travel-map" id="travel-map-canvas" aria-label="Interactive map of visited places" />
}

export default defineIsland('travel-map', TravelMap)
