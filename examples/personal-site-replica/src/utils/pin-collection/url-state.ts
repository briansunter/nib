/**
 * Single source of truth for pin-collection UI state.
 *
 * All four pieces of state live in query params on /pin-collection:
 *
 *   ?pin=<id>      - which pin's detail is open (omitted = closed)
 *   ?view=map      - map vs grid toggle           (omitted = grid)
 *   ?z=<num>       - current map zoom
 *   ?c=<lat,lng>   - current map center
 *
 * Most updates use `history.replaceState` so Nib navigation does not treat a
 * same-pathname query change as a document transition.
 * Opening a pin can opt into `pushState` so browser Back closes the overlay
 * before leaving the page.
 */

export interface PinCollectionState {
  pin: string | null;
  view: 'grid' | 'map';
  zoom: number | null;
  center: [number, number] | null;
}

function parseCenter(raw: string | null): [number, number] | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  const [lat, lng] = parts.map(Number.parseFloat);
  const inBounds =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
  return inBounds ? [lat, lng] : null;
}

export function readState(): PinCollectionState {
  const p = new URL(window.location.href).searchParams;
  const z = p.get('z');
  const zoom = z !== null ? Number.parseFloat(z) : null;
  return {
    pin: p.get('pin'),
    view: p.get('view') === 'map' ? 'map' : 'grid',
    zoom: zoom !== null && Number.isFinite(zoom) ? zoom : null,
    center: parseCenter(p.get('c')),
  };
}

/**
 * Merge `patch` into the current URL state and write it back. Only
 * keys present in `patch` are touched, so callers can update one
 * piece of state without clobbering the others.
 */
export function writeState(
  patch: Partial<PinCollectionState>,
  options: { mode?: 'replace' | 'push' } = {},
): void {
  const url = new URL(window.location.href);
  const p = url.searchParams;

  if ('pin' in patch) {
    if (patch.pin) p.set('pin', patch.pin);
    else p.delete('pin');
  }
  if ('view' in patch) {
    if (patch.view === 'map') p.set('view', 'map');
    else p.delete('view');
  }
  if ('zoom' in patch) {
    if (patch.zoom !== null && patch.zoom !== undefined) {
      p.set('z', patch.zoom.toString());
    } else {
      p.delete('z');
    }
  }
  if ('center' in patch) {
    if (patch.center) {
      p.set('c', `${patch.center[0].toFixed(4)},${patch.center[1].toFixed(4)}`);
    } else {
      p.delete('c');
    }
  }

  // Old shareable URLs used #pin-<id>; clean it up once we've migrated
  // the state to ?pin=<id> so the URL bar isn't littered with both.
  if (url.hash.startsWith('#pin-')) url.hash = '';

  if (options.mode === 'push') {
    history.pushState(history.state, '', url);
  } else {
    history.replaceState(history.state, '', url);
  }
}

/**
 * Pull the legacy `#pin-<id>` fragment, if present, so we can open the
 * right modal on shareable URLs from before the migration.
 */
export function legacyHashPin(): string | null {
  const hash = window.location.hash;
  return hash.startsWith('#pin-') ? hash.slice(5) : null;
}
