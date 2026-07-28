/**
 * Sticky nav and hide-text toggle for the pin collection page. Extracted
 * from `src/utils/pinCollectionInitializer.ts`. Dropdown behaviour now lives
 * in `src/utils/dropdown.ts`.
 */

const LOGO_SHOW_THRESHOLD = 50;

export interface StickyNavOptions {
  signal: AbortSignal;
}

/**
 * Wires up the BS logo / sticky nav scroll behaviour. Adds the `visible`
 * class to `#bs-logo` once the user has scrolled past `LOGO_SHOW_THRESHOLD`.
 */
export function initStickyNav({ signal }: StickyNavOptions): void {
  const bsLogo = document.getElementById('bs-logo');

  function updateNavState() {
    if (!bsLogo) return;
    if (window.scrollY > LOGO_SHOW_THRESHOLD) {
      bsLogo.classList.add('visible');
    } else {
      bsLogo.classList.remove('visible');
    }
  }

  window.addEventListener('scroll', updateNavState, { passive: true, signal });
  updateNavState();
}

/**
 * Wires up the hide-text toggle. When pressed it adds `hide-labels` to the
 * `.display-case` container, toggling label visibility.
 */
export function initHideText({ signal }: StickyNavOptions): void {
  const hideTextToggle = document.getElementById('hide-text-toggle');
  const displayCase = document.querySelector('.display-case');
  hideTextToggle?.addEventListener(
    'click',
    () => {
      const isActive = hideTextToggle.classList.toggle('active');
      hideTextToggle.setAttribute('aria-pressed', String(isActive));
      displayCase?.classList.toggle('hide-labels', isActive);
    },
    { signal },
  );
}
