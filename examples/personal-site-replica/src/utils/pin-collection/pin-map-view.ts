/**
 * Pin-collection map view toggle.
 *
 * Owns: showing/hiding the global Leaflet map (`#pin-map-view`) in place
 * of the grid (`#pin-grid` and its `#pin-no-results` empty state),
 * lazy-initializing the Leaflet instance the first time the user toggles
 * to map view, and wiring marker clicks to the modal opener.
 *
 * URL state (view mode, zoom, center) lives in `./url-state`. We read
 * it on init to restore the previous map view, and write back via the
 * shared `writeState` on toggle changes and (debounced) map moves.
 */

import type L from 'leaflet';
import { trackEvent } from '../../lib/analytics';
import { parseDatasetJSON } from '../../lib/html-utils';
import { applyFullscreenState } from '../fullscreen-toggle';
import {
  destroyMap,
  initMultiMarkerMap,
  invalidateVisibleMaps,
  type MarkerSpec,
} from '../mapInitializer';
import { readState, writeState } from './url-state';

interface PinMarkerData extends MarkerSpec {
  id: string;
}

interface SetModeOptions {
  persist?: boolean;
}
interface FullscreenOptions {
  refresh?: boolean;
}

export interface PinMapViewOptions {
  signal: AbortSignal;
  openPin(pinId: string): void;
}

export function initPinMapView({ signal, openPin }: PinMapViewOptions) {
  const toggle = document.getElementById('pin-view-toggle');
  const mapSection = document.getElementById('pin-map-view');
  const mapEl = document.getElementById('pin-map');
  const grid = document.getElementById('pin-grid');
  const noResults = document.getElementById('pin-no-results');
  const board = document.querySelector(
    '.pin-board-content',
  ) as HTMLElement | null;

  if (!toggle || !mapSection || !mapEl || !grid) return;

  let leafletMap: L.Map | null = null;

  function readMarkers(): PinMarkerData[] {
    if (!mapEl) return [];
    return parseDatasetJSON<PinMarkerData[]>(
      mapEl,
      'markers',
      [],
      (value): value is PinMarkerData[] => Array.isArray(value),
    );
  }

  // Debounce map-state URL writes - Leaflet fires moveend after every
  // wheel-zoom step, and a history.replaceState mid-zoom makes the
  // next wheel tick feel laggy.
  let moveTimer: number | null = null;
  function scheduleMapStateWrite() {
    if (moveTimer !== null) clearTimeout(moveTimer);
    moveTimer = window.setTimeout(() => {
      moveTimer = null;
      if (!leafletMap) return;
      const c = leafletMap.getCenter();
      writeState({
        zoom: leafletMap.getZoom(),
        center: [c.lat, c.lng],
      });
    }, 400);
  }

  signal.addEventListener(
    'abort',
    () => {
      if (moveTimer !== null) clearTimeout(moveTimer);
      moveTimer = null;
      // Leaflet listeners aren't AbortSignal-aware, so detach explicitly
      // to match the DOM listeners' lifetime.
      leafletMap?.off('moveend', scheduleMapStateWrite);
      setFullscreen(false, { refresh: false });
      setMode('grid', { persist: false });
      destroyMap('pin-map');
      leafletMap = null;
    },
    { once: true },
  );

  function ensureMapInitialized() {
    if (leafletMap) {
      invalidateVisibleMaps();
      return;
    }
    const markers = readMarkers();
    // Restoring zoom/center via initialView (instead of a post-init
    // setView) lets initMultiMarkerMap skip its fitBounds, so the
    // fitBounds animation can't visibly stomp on the requested view.
    const { center, zoom } = readState();
    const initialView = center && zoom !== null ? { center, zoom } : undefined;
    leafletMap = initMultiMarkerMap({
      containerId: 'pin-map',
      markers,
      fallbackCenter: [20, 0],
      fallbackZoom: 2,
      initialView,
      onMarkerClick: (pinId) => {
        trackEvent('pin_map_marker_click', { pin_id: pinId });
        openPin(pinId);
      },
    });
    // moveend fires after both pan and zoom settle, so one listener
    // covers both.
    leafletMap?.on('moveend', scheduleMapStateWrite);
  }

  function setMode(
    mode: 'grid' | 'map',
    { persist = true }: SetModeOptions = {},
  ) {
    if (!toggle || !mapSection || !grid) return;
    toggle.dataset.mode = mode;
    toggle.setAttribute('aria-pressed', mode === 'map' ? 'true' : 'false');

    // Swap the icon + label inside the toggle so the button's affordance
    // matches the state the user would move *to*.
    toggle.querySelectorAll<HTMLElement>('[data-mode-icon]').forEach((el) => {
      el.classList.toggle('hidden', el.dataset.modeIcon === mode);
    });
    toggle.querySelectorAll<HTMLElement>('[data-mode-label]').forEach((el) => {
      el.classList.toggle('hidden', el.dataset.modeLabel === mode);
    });

    const isMap = mode === 'map';
    if (isMap) {
      grid.classList.add('hidden');
      noResults?.classList.add('hidden');
      mapSection.classList.remove('hidden');
      mapSection.setAttribute('aria-hidden', 'false');
      board?.classList.add('is-map-view');
      ensureMapInitialized();
    } else {
      mapSection.classList.add('hidden');
      mapSection.setAttribute('aria-hidden', 'true');
      grid.classList.remove('hidden');
      board?.classList.remove('is-map-view');
    }
    // Body class drives global chrome rules (e.g. hide the pin-collection
    // sticky toolbar so the map can use the full page width).
    document.body.classList.toggle('pin-map-mode-active', isMap);
    // Mirror the mode change to ?view. Zoom/center are left untouched
    // so toggling away to grid and back restores the previous pan/zoom
    // instead of reverting to the fitBounds default.
    if (persist) writeState({ view: mode });
  }

  // Floating "back to grid" button sits in the map's lower-left corner
  // (visible only in map view since its container is). One-way affordance:
  // always switches to grid, mirroring the toolbar's toggle.
  document.getElementById('pin-map-back')?.addEventListener(
    'click',
    () => {
      setMode('grid');
      trackEvent('pin_map_toggle', { mode: 'grid', source: 'back_button' });
    },
    { signal },
  );

  toggle.addEventListener(
    'click',
    () => {
      const next = toggle.dataset.mode === 'map' ? 'grid' : 'map';
      setMode(next);
      trackEvent('pin_map_toggle', { mode: next, source: 'toolbar' });
    },
    { signal },
  );

  // ----- Fullscreen toggle -----
  const fsBtn = document.getElementById('pin-map-fullscreen');
  const wrap = document.getElementById('pin-map-wrap');
  function setFullscreen(
    on: boolean,
    { refresh = true }: FullscreenOptions = {},
  ) {
    if (!fsBtn || !wrap) return;
    applyFullscreenState(
      {
        wrapper: wrap,
        button: fsBtn,
        bodyClass: 'pin-map-fullscreen-open',
        enterLabel: 'Toggle full screen map',
        exitLabel: 'Exit full screen map',
      },
      on,
    );
    // Layout has changed - let Leaflet recompute tile/marker positions.
    if (refresh) window.setTimeout(() => invalidateVisibleMaps(), 0);
  }
  function toggleFullscreen() {
    if (!wrap) return;
    const next = !wrap.classList.contains('is-fullscreen');
    setFullscreen(next);
    trackEvent('pin_map_fullscreen_toggle', { enabled: next });
  }
  fsBtn?.addEventListener('click', toggleFullscreen, { signal });
  // Escape exits fullscreen - capture on window so it works regardless
  // of focus position.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && wrap?.classList.contains('is-fullscreen')) {
        e.preventDefault();
        setFullscreen(false);
      }
    },
    { signal },
  );

  // Restore view mode from the URL on init - `?view=map` should
  // re-apply after any astro:page-load.
  if (readState().view === 'map' && toggle.dataset.mode !== 'map') {
    setMode('map');
  }
}
