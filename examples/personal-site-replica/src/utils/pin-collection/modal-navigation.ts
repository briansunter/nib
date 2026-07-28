/**
 * One-data-model pin detail viewer.
 *
 * The page renders one native dialog and a compact JSON record for each pin.
 * This controller populates that dialog on demand, so collection size no
 * longer multiplies modal markup, images, maps, or event listeners.
 */

import { trackEvent } from '../../lib/analytics';
import { destroyMap, initSinglePointMap } from '../mapInitializer';
import { legacyHashPin, readState, writeState } from './url-state';

export interface PinDetailRecord {
  id: string;
  name: string;
  description?: string;
  category: string;
  acquired: string;
  acquiredAt?: string;
  maker?: string;
  source?: string;
  tags: string[];
  favorite: boolean;
  image: { src: string; width: number; height: number };
  gps?: { lat: number; lng: number };
}

export interface ModalNavigationOptions {
  signal: AbortSignal;
  getVisiblePinIds(): string[];
}

export interface ModalNavigationHandle {
  openModal(pinId: string): void;
  closeModal(): void;
}

type ModalHistoryMode = 'auto' | 'replace';

interface ModalOpenOptions {
  historyMode?: ModalHistoryMode;
}

interface ModalCloseOptions {
  updateUrl?: boolean;
}

function readPinDetails(): Map<string, PinDetailRecord> {
  const node = document.getElementById('pin-detail-data');
  if (!node?.textContent) return new Map();

  try {
    const records = JSON.parse(node.textContent) as PinDetailRecord[];
    return new Map(records.map((record) => [record.id, record]));
  } catch {
    return new Map();
  }
}

function setText(id: string, value = '') {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setOptionalField(field: string, value?: string) {
  const row = document.querySelector<HTMLElement>(
    `[data-pin-field="${field}"]`,
  );
  if (!row) return;
  row.hidden = !value;
  const valueElement = row.querySelector<HTMLElement>('dd');
  if (valueElement) valueElement.textContent = value ?? '';
}

function showDialog(dialog: HTMLDialogElement) {
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function hideDialog(dialog: HTMLDialogElement) {
  if (!dialog.open && !dialog.hasAttribute('open')) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

export function initModalNavigation({
  signal,
  getVisiblePinIds,
}: ModalNavigationOptions): ModalNavigationHandle {
  const modal = document.getElementById(
    'pin-modal',
  ) as HTMLDialogElement | null;
  const detail = modal?.querySelector<HTMLElement>('.pin-detail') ?? null;
  const pinsById = readPinDetails();
  let currentPinId: string | null = null;
  let lastFocused: HTMLElement | null = null;

  function isOpen() {
    return modal?.open === true || modal?.hasAttribute('open') === true;
  }

  function isFullscreen() {
    return modal?.classList.contains('pin-fullscreen-mode') === true;
  }

  function exitFullscreen() {
    if (!modal) return;
    modal.classList.remove('pin-fullscreen-mode');
    const button = modal.querySelector<HTMLButtonElement>(
      '.pin-fullscreen-btn',
    );
    if (button) {
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', 'View pin image fullscreen');
    }
  }

  function populate(record: PinDetailRecord) {
    if (!modal || !detail) return;
    detail.dataset.pinId = record.id;
    modal.dataset.pinId = record.id;

    setText('pin-detail-category', record.category);
    setText('pin-modal-title', record.name);
    setText('pin-modal-description', record.description);
    setText('pin-detail-acquired', record.acquired);
    setOptionalField('acquired-at', record.acquiredAt);
    setOptionalField('maker', record.maker);
    setOptionalField('source', record.source);

    const description = document.getElementById('pin-modal-description');
    if (description) description.hidden = !record.description;
    if (record.description) {
      modal.setAttribute('aria-describedby', 'pin-modal-description');
    } else {
      modal.removeAttribute('aria-describedby');
    }

    const favorite = document.getElementById('pin-detail-favorite');
    if (favorite) favorite.hidden = !record.favorite;

    const image = document.getElementById(
      'pin-detail-image',
    ) as HTMLImageElement | null;
    if (image) {
      image.src = record.image.src;
      image.alt = record.name;
      image.width = record.image.width;
      image.height = record.image.height;
      image.fetchPriority = 'high';
    }

    const tags = document.getElementById('pin-detail-tags');
    if (tags) {
      tags.replaceChildren(
        ...record.tags.map((tag) => {
          const element = document.createElement('span');
          element.className = 'pin-detail-tag';
          element.textContent = `#${tag}`;
          return element;
        }),
      );
      tags.hidden = record.tags.length === 0;
    }

    const mapElement = document.getElementById('pin-detail-map');
    destroyMap('pin-detail-map');
    if (mapElement) {
      mapElement.hidden = !record.gps;
      if (record.gps) {
        mapElement.dataset.lat = String(record.gps.lat);
        mapElement.dataset.lng = String(record.gps.lng);
        const map = initSinglePointMap(
          'pin-detail-map',
          record.gps.lat,
          record.gps.lng,
        );
        if (map) setTimeout(() => map.invalidateSize(), 60);
      }
    }

    modal.dispatchEvent(new CustomEvent('pin-detail-change'));
  }

  function updateNavigation() {
    if (!modal || !currentPinId) return;
    const visibleIds = getVisiblePinIds();
    const index = visibleIds.indexOf(currentPinId);
    const previous = modal.querySelector<HTMLButtonElement>('.pin-nav-prev');
    const next = modal.querySelector<HTMLButtonElement>('.pin-nav-next');
    if (previous) previous.disabled = index <= 0;
    if (next) next.disabled = index < 0 || index >= visibleIds.length - 1;
  }

  function shouldPushPinEntry(pinId: string, options?: ModalOpenOptions) {
    if (options?.historyMode === 'replace') return false;
    return currentPinId === null && readState().pin !== pinId;
  }

  function openModal(pinId: string, options?: ModalOpenOptions) {
    if (!modal) return;
    const record = pinsById.get(pinId);
    if (!record) return;
    const shouldPush = shouldPushPinEntry(pinId, options);

    if (!isOpen()) {
      const focused = document.activeElement;
      lastFocused = focused instanceof HTMLElement ? focused : null;
    }

    populate(record);
    currentPinId = pinId;
    updateNavigation();
    showDialog(modal);

    if (lastFocused?.classList.contains('pin-card-trigger')) {
      requestAnimationFrame(() =>
        document.getElementById('pin-modal-close')?.focus(),
      );
    }

    const mapSection = document.getElementById('pin-map-view');
    const openedFromMap =
      !!mapSection && !mapSection.classList.contains('hidden');
    trackEvent('pin_open', {
      pin_id: pinId,
      source: openedFromMap ? 'map' : 'grid',
      viewport: window.innerWidth < 768 ? 'mobile' : 'desktop',
    });
    writeState({ pin: pinId }, { mode: shouldPush ? 'push' : 'replace' });
  }

  function closeModal(options: ModalCloseOptions = {}) {
    if (!modal || !isOpen()) return;
    exitFullscreen();
    hideDialog(modal);
    destroyMap('pin-detail-map');
    currentPinId = null;
    if (options.updateUrl !== false) writeState({ pin: null });
    lastFocused?.focus();
    lastFocused = null;
  }

  function navigate(direction: -1 | 1) {
    if (!currentPinId) return;
    const ids = getVisiblePinIds();
    const index = ids.indexOf(currentPinId);
    const nextId = ids[index + direction];
    if (!nextId) return;
    trackEvent('pin_modal_navigate', {
      direction: direction === -1 ? 'previous' : 'next',
      pin_id: currentPinId,
    });
    openModal(nextId);
  }

  function syncPinFromUrl() {
    const pinId = readState().pin ?? legacyHashPin();
    if (!pinId) {
      closeModal({ updateUrl: false });
      return;
    }
    if (pinId !== currentPinId || !isOpen()) {
      openModal(pinId, { historyMode: 'replace' });
    }
  }

  document
    .querySelectorAll<HTMLButtonElement>('.pin-card-trigger[data-pin-id]')
    .forEach((trigger) => {
      trigger.addEventListener(
        'click',
        () => {
          const pinId = trigger.dataset.pinId;
          if (pinId) openModal(pinId);
        },
        { signal },
      );
    });

  document
    .getElementById('pin-modal-close')
    ?.addEventListener('click', () => closeModal(), { signal });
  modal
    ?.querySelector('.pin-nav-prev')
    ?.addEventListener('click', () => navigate(-1), { signal });
  modal
    ?.querySelector('.pin-nav-next')
    ?.addEventListener('click', () => navigate(1), { signal });

  modal?.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      if (isFullscreen()) exitFullscreen();
      else closeModal();
    },
    { signal },
  );
  modal?.addEventListener(
    'click',
    (event) => {
      if (event.target === modal) closeModal();
    },
    { signal },
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (!isOpen()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (isFullscreen()) exitFullscreen();
        else closeModal();
      } else if (event.key === 'ArrowLeft') {
        navigate(-1);
      } else if (event.key === 'ArrowRight') {
        navigate(1);
      }
    },
    { signal },
  );

  window.addEventListener('popstate', syncPinFromUrl, { signal });

  const initialPin = readState().pin ?? legacyHashPin();
  if (initialPin) {
    requestAnimationFrame(() =>
      openModal(initialPin, { historyMode: 'replace' }),
    );
  }

  return { openModal, closeModal };
}
