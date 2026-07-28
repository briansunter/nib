import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png?url';
import icon2x from 'leaflet/dist/images/marker-icon-2x.png?url';
import markerShadow from 'leaflet/dist/images/marker-shadow.png?url';
import { escapeHtml } from '../lib/html-utils';
import {
  centroidOf,
  clusterByProximity,
  clusterRadius,
  clusterSizingForZoom,
  decideHiddenLabels,
  isMobileViewport,
  type LabelCandidate,
  type LabelGeometry,
  labelRectBelowAnchor,
  MOBILE_BREAKPOINT_PX,
  ringPositions,
  sortIndicesByName,
  zoomBucket,
} from './pin-map-clustering';

// Tile layer URLs. Light: Voyager. Dark: Positron (light_all) - a
// subtle grayscale that pairs well with the CSS filter applied in dark
// mode.
const TILE_LIGHT =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_DARK =
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

const myIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: icon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  shadowSize: [41, 41],
  iconAnchor: [12, 41],
  shadowAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface MapInstance {
  map: L.Map;
  tileLayer: L.TileLayer;
  refreshLayout?: () => void;
}

const mapInstances = new Map<string, MapInstance>();

let controller: AbortController | null = null;
let themeObserver: MutationObserver | null = null;
let visibilityObserver: IntersectionObserver | null = null;

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function createTileLayer(maxZoom = 19): L.TileLayer {
  return L.tileLayer(isDarkMode() ? TILE_DARK : TILE_LIGHT, {
    subdomains: 'abcd',
    maxZoom,
  });
}

function liftLeafletControls(container: HTMLElement): void {
  // Keep Leaflet's zoom controls above the tiles (default ~200-400)
  // but under the site navbar (z-1000).
  container
    .querySelectorAll<HTMLElement>('.leaflet-top, .leaflet-bottom')
    .forEach((el) => {
      el.style.zIndex = '500';
    });
}

function createMapOverlay(container: HTMLElement, map: L.Map): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'map-touch-overlay';
  overlay.innerHTML = `
    <div class="map-overlay-content">
      <svg class="map-overlay-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
      </svg>
      <span>Tap to interact</span>
    </div>
  `;

  container.style.position = 'relative';
  overlay.style.cssText = `
    position: absolute;
    inset: 0;
    z-index: 500;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    padding: 0.5rem;
    cursor: pointer;
    transition: opacity 0.2s ease;
    border-radius: inherit;
  `;

  const content = overlay.querySelector('.map-overlay-content') as HTMLElement;
  if (content) {
    content.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    `;
  }

  const iconEl = overlay.querySelector('.map-overlay-icon') as HTMLElement;
  if (iconEl) {
    iconEl.style.cssText = `
      width: 1.25rem;
      height: 1.25rem;
    `;
  }

  overlay.addEventListener('click', (e) => {
    e.stopPropagation();
    unlockMap(map, overlay);
  });

  container.appendChild(overlay);
  return overlay;
}

function unlockMap(map: L.Map, overlay: HTMLElement) {
  map.dragging.enable();
  map.touchZoom.enable();
  map.doubleClickZoom.enable();
  map.scrollWheelZoom.enable();

  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  setTimeout(() => overlay.remove(), 200);
}

function initMap(id: string, lat: number, lng: number) {
  const container = document.getElementById(id);
  if (!container) return;
  if (container.dataset.mapInitialized === 'true') return;

  const isTouch = isTouchDevice();

  const map = L.map(id, {
    zoomControl: true,
    attributionControl: false,
    dragging: !isTouch,
    scrollWheelZoom: !isTouch,
    doubleClickZoom: !isTouch,
    touchZoom: !isTouch,
  }).setView([lat, lng], 8);

  const tileLayer = createTileLayer(20).addTo(map);
  L.marker([lat, lng], { icon: myIcon }).addTo(map);
  mapInstances.set(id, { map, tileLayer });

  if (isTouch) createMapOverlay(container, map);

  liftLeafletControls(container);
  container.dataset.mapInitialized = 'true';
}

function updateMapThemes() {
  mapInstances.forEach((entry) => {
    const { map, tileLayer } = entry;
    map.removeLayer(tileLayer);
    const newTileLayer = createTileLayer(20).addTo(map);
    entry.tileLayer = newTileLayer;
  });
}

function stopThemeObserver() {
  controller?.abort();
  controller = null;
  themeObserver?.disconnect();
  themeObserver = null;
  visibilityObserver?.disconnect();
  visibilityObserver = null;
}

export function destroyMaps() {
  stopThemeObserver();
  mapInstances.forEach(({ map }, id) => {
    map.remove();
    const container = document.getElementById(id);
    if (container) delete container.dataset.mapInitialized;
  });
  mapInstances.clear();
}

export function initMaps({ lazy = false }: { lazy?: boolean } = {}) {
  destroyMaps();

  const elements = document.querySelectorAll<HTMLElement>('.map-element');
  const initialize = (element: HTMLElement) => {
    const { id, lat, lng } = element.dataset;
    if (id && lat && lng) {
      initMap(id, Number.parseFloat(lat), Number.parseFloat(lng));
    }
  };

  if (lazy && 'IntersectionObserver' in window) {
    visibilityObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          initialize(entry.target as HTMLElement);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '300px 0px' },
    );
    elements.forEach((element) => {
      visibilityObserver?.observe(element);
    });
  } else {
    elements.forEach(initialize);
  }

  // Single source of truth for the theme-sync listener + MutationObserver.
  // destroyMaps() nulls controller/themeObserver, so this lazily recreates them.
  ensureThemeObserver();
}

/**
 * Invalidate the size of all visible maps - call this after showing
 * a previously-hidden map container (e.g., view toggle).
 */
export function invalidateVisibleMaps() {
  mapInstances.forEach(({ map, refreshLayout }, id) => {
    const container = document.getElementById(id);
    const rect = container?.getBoundingClientRect();
    const isVisible =
      container &&
      (container.offsetParent !== null ||
        (rect !== undefined && rect.width > 0 && rect.height > 0));
    if (isVisible) {
      map.invalidateSize();
      refreshLayout?.();
    }
  });
}

export interface MarkerSpec {
  lat: number;
  lng: number;
  /** Identifier returned via `onMarkerClick` and used in the popup data attr. */
  id?: string;
  /** Display name in the popup. */
  name?: string;
  /** Optional thumbnail URL - rendered inside the popup if present. */
  thumbnail?: string;
  /** Optional secondary line (location, date, etc.). */
  subtitle?: string;
}

export interface MultiMarkerOptions {
  /** Container `id` to mount the Leaflet map into. */
  containerId: string;
  markers: MarkerSpec[];
  /** Initial padding when fitting bounds. */
  fitPadding?: [number, number];
  /** Default center if `markers` is empty. */
  fallbackCenter?: [number, number];
  /** Default zoom if `markers` is empty. */
  fallbackZoom?: number;
  /** Invoked when the user clicks a marker (only for markers with an `id`). */
  onMarkerClick?: (markerId: string) => void;
  /**
   * Explicit starting view. When supplied the map opens at this
   * center/zoom and `fitBounds` is skipped, so a restored URL view
   * isn't overwritten by the fitBounds animation.
   */
  initialView?: { center: [number, number]; zoom: number };
}

interface StoredMarker {
  marker: L.Marker;
  origin: L.LatLng;
}

const ZOOM_CLASS_PREFIX = 'pin-map-zoom-' as const;
const CLUSTER_CLASS = 'is-clustered';
const LEADER_CLASS = 'is-cluster-leader';
const HIDE_LABEL_CLASS = 'pin-map-marker-no-label';
// Clustering itself runs at every zoom: anything within the proximity
// threshold gets the `is-clustered` class (→ small-circle style). Below
// MIN_RING_SPREAD_ZOOM we skip the ring-spread step so cluster members
// stack at their lat/lng instead of fanning out 30–80 px (which at
// world/continent scale can land in the ocean or across a state line).
const MIN_CLUSTER_ZOOM = 3;
const MIN_RING_SPREAD_ZOOM = 6;

/**
 * Build a multi-marker map and register it for the shared theme observer.
 * Safe to call repeatedly - a prior map on the same container is torn
 * down first.
 */
export function initMultiMarkerMap({
  containerId,
  markers,
  fitPadding = [40, 40],
  fallbackCenter = [20, 0],
  fallbackZoom = 2,
  onMarkerClick,
  initialView,
}: MultiMarkerOptions): L.Map | null {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const prior = mapInstances.get(containerId);
  if (prior) {
    prior.map.remove();
    mapInstances.delete(containerId);
  }
  delete container.dataset.mapInitialized;

  const startCenter = initialView?.center ?? fallbackCenter;
  const startZoom = initialView?.zoom ?? fallbackZoom;
  const map = L.map(containerId, {
    zoomControl: true,
    attributionControl: false,
    scrollWheelZoom: true,
    touchZoom: true,
    doubleClickZoom: true,
    worldCopyJump: true,
  }).setView(startCenter, startZoom);

  const tileLayer = createTileLayer().addTo(map);

  const stored: StoredMarker[] = markers.map((m) => {
    const origin = L.latLng(m.lat, m.lng);
    const marker = L.marker(origin, {
      icon: buildPinMarkerIcon(m),
      riseOnHover: true,
      riseOffset: 1000,
      alt: m.name ?? '',
    }).addTo(map);
    if (m.id && onMarkerClick) {
      const markerId = m.id;
      marker.on('click', () => onMarkerClick(markerId));
    }
    return { marker, origin };
  });

  // Captured by `spreadOverlapping` each pass; `updateLabelVisibility`
  // uses it to treat each cluster as one atomic group.
  let clusterGroups: number[][] = [];

  const markerName = (i: number): string => stored[i].marker.options.alt ?? '';
  const markerEl = (i: number): HTMLElement | undefined =>
    stored[i].marker.getElement() ?? undefined;
  const isMobileLayout = () => isMobileViewport(window.innerWidth);

  const spreadOverlapping = () => {
    const zoom = map.getZoom();
    clusterGroups = [];

    // Reset every marker to its origin and strip cluster classes -
    // we'll re-spread the ones that still overlap below.
    for (const s of stored) {
      if (!s.marker.getLatLng().equals(s.origin)) s.marker.setLatLng(s.origin);
      const el = s.marker.getElement();
      el?.classList.remove(CLUSTER_CLASS, LEADER_CLASS);
    }

    if (zoom < MIN_CLUSTER_ZOOM) return;

    const sizing = clusterSizingForZoom(zoom, isMobileLayout());
    const projected = stored.map((s) => {
      const pt = map.latLngToContainerPoint(s.origin);
      return { x: pt.x, y: pt.y };
    });
    const groups = clusterByProximity(projected, {
      threshold: sizing.threshold,
    });

    const names = stored.map((_, i) => markerName(i));
    const shouldRingSpread = zoom >= MIN_RING_SPREAD_ZOOM;
    for (const rawGroup of groups) {
      if (rawGroup.length < 2) continue;
      const group = sortIndicesByName(rawGroup, names);
      const n = group.length;
      const centroid = centroidOf(group.map((idx) => projected[idx]));
      const radius = shouldRingSpread ? clusterRadius(n, zoom, sizing) : 0;
      const ring = ringPositions(centroid, n, radius);

      group.forEach((idx, k) => {
        if (shouldRingSpread) {
          const { x, y } = ring[k];
          const nextLatLng = map.containerPointToLatLng([x, y]);
          if (!stored[idx].marker.getLatLng().equals(nextLatLng)) {
            stored[idx].marker.setLatLng(nextLatLng);
          }
        }
        const el = markerEl(idx);
        el?.classList.add(CLUSTER_CLASS);
        if (k === 0) el?.classList.add(LEADER_CLASS);
      });
      clusterGroups.push(group);
    }
  };

  const updateLabelVisibility = () => {
    const geom: LabelGeometry = {
      zoom: map.getZoom(),
      mobile: isMobileLayout(),
    };
    const candidates: LabelCandidate[] = stored.map((s, i) => {
      const pt = map.latLngToContainerPoint(s.marker.getLatLng());
      const name = markerName(i);
      return { rect: labelRectBelowAnchor(pt, name, geom), name };
    });

    const hidden = decideHiddenLabels({ candidates, clusterGroups });

    for (let i = 0; i < stored.length; i++) {
      const el = markerEl(i);
      if (!el) continue;
      el.classList.toggle(HIDE_LABEL_CLASS, hidden.has(i));
    }
  };

  const updateZoomClass = () => {
    const bucket = zoomBucket(map.getZoom());
    for (let i = 1; i <= 5; i++) {
      container.classList.toggle(`${ZOOM_CLASS_PREFIX}${i}`, i === bucket);
    }
  };

  const refreshLayout = () => {
    updateZoomClass();
    spreadOverlapping();
    updateLabelVisibility();
  };

  updateZoomClass();
  map.on('zoomend', () => {
    refreshLayout();
  });
  map.on('moveend', () => {
    refreshLayout();
  });
  map.on('resize', () => {
    refreshLayout();
  });
  map.whenReady(() => {
    setTimeout(() => {
      refreshLayout();
    }, 0);
  });

  const latLngs = markers.map((m) => [m.lat, m.lng] as L.LatLngTuple);
  if (!initialView && latLngs.length > 0) {
    map.fitBounds(L.latLngBounds(latLngs), {
      padding: fitPadding,
      maxZoom: 12,
    });
  }

  mapInstances.set(containerId, { map, tileLayer, refreshLayout });
  container.dataset.mapInitialized = 'true';
  liftLeafletControls(container);
  ensureThemeObserver();

  return map;
}

/**
 * Single-marker map used by the pin detail modal. Caches by container
 * id and reuses the prior map if the DOM node still matches.
 */
export function initSinglePointMap(
  containerId: string,
  lat: number,
  lng: number,
  zoom = 6,
): L.Map | null {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const existing = mapInstances.get(containerId);
  if (existing) {
    // If the cached map's DOM node is still live, reuse it. After an
    // Astro page swap the node has been replaced, so tear down and
    // re-init.
    if (existing.map.getContainer() === container) return existing.map;
    existing.map.remove();
    mapInstances.delete(containerId);
  }
  delete container.dataset.mapInitialized;

  const map = L.map(containerId, {
    zoomControl: true,
    attributionControl: false,
    scrollWheelZoom: true,
    touchZoom: true,
    doubleClickZoom: true,
    dragging: true,
  }).setView([lat, lng], zoom);

  const tileLayer = createTileLayer().addTo(map);
  L.marker([lat, lng], { icon: myIcon }).addTo(map);

  mapInstances.set(containerId, { map, tileLayer });
  container.dataset.mapInitialized = 'true';
  ensureThemeObserver();
  return map;
}

/** Remove the map for a single container id. No-op if it doesn't exist. */
export function destroyMap(containerId: string) {
  const entry = mapInstances.get(containerId);
  if (!entry) return;
  entry.map.remove();
  mapInstances.delete(containerId);
  const container = document.getElementById(containerId);
  if (container) delete container.dataset.mapInitialized;
  if (mapInstances.size === 0) stopThemeObserver();
}

const ANCHOR_SVG = `<svg viewBox="0 0 16 22" width="16" height="22" aria-hidden="true" focusable="false"><path d="M8 0C3.582 0 0 3.582 0 8c0 5.6 8 14 8 14s8-8.4 8-14c0-4.418-3.582-8-8-8z" fill="#dc2626" stroke="#7f1d1d" stroke-width="1"/><circle cx="8" cy="8" r="3" fill="#fff8e7"/></svg>`;

function buildPinMarkerIcon(m: MarkerSpec): L.DivIcon {
  const safeName = escapeHtml(m.name ?? '');
  const safeThumb = m.thumbnail ? escapeHtml(m.thumbnail) : '';
  const html = `
    <div class="pin-map-marker">
      <div class="pin-map-marker-stack">
        <div class="pin-map-marker-thumb">
          ${safeThumb ? `<img src="${safeThumb}" alt="${safeName}" loading="lazy" draggable="false" />` : ''}
        </div>
        <div class="pin-map-marker-anchor">${ANCHOR_SVG}</div>
      </div>
      ${safeName ? `<div class="pin-map-marker-name">${safeName}</div>` : ''}
    </div>
  `.trim();
  return L.divIcon({
    className: 'pin-map-marker-icon',
    html,
    // Container height exactly = ICON_ANCHOR_Y so the anchor's tip sits
    // at the bottom-center of the icon box (label overflows below).
    iconSize: [144, 100],
    iconAnchor: [72, 100],
  });
}

function ensureThemeObserver() {
  if (controller && themeObserver) return;
  controller ??= new AbortController();
  window.addEventListener('theme-changed', updateMapThemes, {
    signal: controller.signal,
  });
  if (!themeObserver) {
    themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          updateMapThemes();
        }
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true });
  }
}

// Re-exported for tests / consumers that want layout-aware sizing
// outside of an active map instance.
export { MOBILE_BREAKPOINT_PX };
