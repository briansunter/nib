/**
 * Layout-agnostic dropdown wiring shared by the photos and pin-collection
 * pages. The DOM contract both pages share:
 *   - a `.dropdown-btn` trigger element
 *   - a `.dropdown-menu` container that gains the `.open` class when shown
 *   - the trigger sitting as the menu's `previousElementSibling`
 *   - the trigger reflecting state via `aria-expanded`
 *
 * Callers pair `setupDropdown` (per trigger) with a single
 * `initDropdownDismissal` (document-level outside-click + Escape).
 */

export interface DropdownOptions {
  signal: AbortSignal;
}

/**
 * Wires a single trigger button so clicking it toggles its menu's `.open`
 * class and the trigger's `aria-expanded`. Opening a dropdown closes every
 * other open `.dropdown-menu` and resets the adjacent trigger's
 * `aria-expanded`. The click is stopped from propagating so the
 * document-level outside-click dismissal does not immediately re-close it.
 */
export function setupDropdown(
  btnId: string,
  menuId: string,
  { signal }: DropdownOptions,
): void {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  btn?.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      document.querySelectorAll('.dropdown-menu.open').forEach((m) => {
        if (m.id !== menuId) {
          m.classList.remove('open');
          (m.previousElementSibling as HTMLElement | null)?.setAttribute(
            'aria-expanded',
            'false',
          );
        }
      });
      menu?.classList.toggle('open');
      btn.setAttribute(
        'aria-expanded',
        String(menu?.classList.contains('open') ?? false),
      );
    },
    { signal },
  );
}

/**
 * Owns both document-level dismissal paths for every dropdown on the page:
 *   - an outside click closes all open menus and resets every
 *     `.dropdown-btn[aria-expanded="true"]`;
 *   - Escape is a no-op when nothing is open, otherwise it closes each open
 *     menu, resets its adjacent trigger's `aria-expanded`, and returns focus
 *     to that trigger.
 */
export function initDropdownDismissal({ signal }: DropdownOptions): void {
  document.addEventListener(
    'click',
    () => {
      for (const m of document.querySelectorAll('.dropdown-menu.open')) {
        m.classList.remove('open');
      }
      for (const b of document.querySelectorAll(
        '.dropdown-btn[aria-expanded="true"]',
      )) {
        b.setAttribute('aria-expanded', 'false');
      }
    },
    { signal },
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      const openMenus = document.querySelectorAll('.dropdown-menu.open');
      if (openMenus.length === 0) return;
      openMenus.forEach((m) => {
        m.classList.remove('open');
        const trigger = m.previousElementSibling as HTMLElement | null;
        trigger?.setAttribute('aria-expanded', 'false');
        trigger?.focus();
      });
    },
    { signal },
  );
}
