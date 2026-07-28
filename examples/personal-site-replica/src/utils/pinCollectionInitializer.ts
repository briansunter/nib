/**
 * Pin collection page entry point.
 *
 * This file is intentionally thin - it just wires together the four
 * responsibility-focused modules under `./pin-collection/`. See those
 * files for the actual behaviour:
 *
 *   - `./pin-collection/sticky-nav`       - sticky logo, hide-text
 *   - `./dropdown`                       - shared dropdown toggle + dismissal
 *   - `./pin-collection/filters-sort`     - search/category/tag/favourite/sort
 *   - `./pin-collection/modal-navigation` - desktop modal & mobile viewer
 *   - `./pin-collection/pin-map-view`      - global map view/fullscreen
 *   - `./pin-collection/zoom-fullscreen`  - active-detail zoom controls
 */

import { initDropdownDismissal, setupDropdown } from './dropdown';
import { destroyMaps } from './mapInitializer';
import { initFilterSort } from './pin-collection/filters-sort';
import { initModalNavigation } from './pin-collection/modal-navigation';
import { initPinMapView } from './pin-collection/pin-map-view';
import { initHideText, initStickyNav } from './pin-collection/sticky-nav';
import { initZoomContainers } from './pin-collection/zoom-fullscreen';

let controller: AbortController | null = null;

export function initPinCollection() {
  // Tear down anything wired up by a previous init() call (re-init on
  // nib:navigation-load, HMR, etc.).
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  initStickyNav({ signal });
  setupDropdown('pin-sort-btn', 'pin-sort-menu', { signal });
  initHideText({ signal });
  initDropdownDismissal({ signal });

  // Filter/sort owns the visible-pin set; modal navigation reads it.
  const filterSort = initFilterSort({ signal });
  const modal = initModalNavigation({
    signal,
    getVisiblePinIds: () => filterSort.getVisiblePinIds(),
  });

  initPinMapView({ signal, openPin: (pinId) => modal.openModal(pinId) });

  initZoomContainers({ signal });
}

export function destroyPinCollection() {
  controller?.abort();
  controller = null;
  destroyMaps();
  document.body.classList.remove(
    'pin-map-mode-active',
    'pin-map-fullscreen-open',
  );
  document.getElementById('pin-map-wrap')?.classList.remove('is-fullscreen');
}
