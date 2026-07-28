/**
 * Shared fullscreen-panel state applier for the map views.
 *
 * Applies the `is-fullscreen` wrapper class, a page-level body class, the
 * button's `aria-pressed`/`aria-label`, and swaps any opt-in `[data-fs-icon]`
 * expand/collapse icons. The pin board and travel map each wrap this with
 * their own click/Escape wiring and side effects (the pin board re-invalidates
 * Leaflet after the layout change).
 */
export interface FullscreenToggleConfig {
  /** Element that carries the `is-fullscreen` class. */
  wrapper: HTMLElement;
  /** Toggle button, or null when the panel has none. */
  button: HTMLElement | null;
  /** Page-level body class toggled alongside fullscreen. */
  bodyClass: string;
  /** aria-label when entering is the next action. */
  enterLabel: string;
  /** aria-label when exiting is the next action. */
  exitLabel: string;
}

export function applyFullscreenState(
  config: FullscreenToggleConfig,
  on: boolean,
): void {
  const { wrapper, button, bodyClass, enterLabel, exitLabel } = config;

  wrapper.classList.toggle('is-fullscreen', on);
  document.body.classList.toggle(bodyClass, on);

  if (!button) return;

  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', on ? exitLabel : enterLabel);

  // Swap any icons that opt in via data-fs-icon to match the next action.
  const visibleIcon = on ? 'collapse' : 'expand';
  button.querySelectorAll<SVGElement>('[data-fs-icon]').forEach((el) => {
    el.classList.toggle('hidden', el.dataset.fsIcon !== visibleIcon);
  });
}

export function isFullscreenOpen(wrapper: HTMLElement): boolean {
  return wrapper.classList.contains('is-fullscreen');
}
