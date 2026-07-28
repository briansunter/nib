/** Minimal shape of the PhotoSwipe lightbox the history helper relies on. */
interface LightboxLike {
  pswp?: { isOpen?: boolean; close: () => void } | null;
}

/**
 * Current `history.state` as a plain object, or `{}` when it is absent or not
 * an object. Both lightbox initializers spread this before pushing their
 * `photoswipeOpen` flag, so the guard lives in one place.
 */
export function currentHistoryState(): Record<string, unknown> {
  return history.state && typeof history.state === 'object'
    ? (history.state as Record<string, unknown>)
    : {};
}

export interface LightboxHistory {
  /** Start intercepting the browser Back button (idempotent). */
  attach(): void;
  /** Stop intercepting (idempotent). */
  detach(): void;
  /** Whether the in-progress close was triggered by a Back/popstate. */
  isClosingFromPopState(): boolean;
  /** Clear the popstate-close flag after the caller has handled the close. */
  resetClosingFlag(): void;
}

/**
 * Shared "Back button closes the lightbox" behavior for the PhotoSwipe-based
 * galleries (photoSwipeInitializer and proseLightboxInitializer). While the
 * lightbox is open, a browser Back (popstate) closes it instead of navigating
 * away. Callers attach() on open and detach() on close/destroy, and consult
 * isClosingFromPopState() to decide whether their own close handler should
 * still rewind history.
 */
export function createLightboxHistory(lightbox: LightboxLike): LightboxHistory {
  let popStateAttached = false;
  let closingFromPopState = false;

  const handlePopState = (e: PopStateEvent) => {
    if (lightbox.pswp?.isOpen) {
      closingFromPopState = true;
      e.preventDefault();
      lightbox.pswp.close();
    }
  };

  return {
    attach() {
      if (popStateAttached) return;
      window.addEventListener('popstate', handlePopState);
      popStateAttached = true;
    },
    detach() {
      if (!popStateAttached) return;
      window.removeEventListener('popstate', handlePopState);
      popStateAttached = false;
    },
    isClosingFromPopState: () => closingFromPopState,
    resetClosingFlag() {
      closingFromPopState = false;
    },
  };
}
