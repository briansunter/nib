/**
 * Progressive image zoom for the single pin detail dialog.
 *
 * Wheel, double-click, drag, and pinch remain convenient pointer shortcuts;
 * visible buttons make zoom and reset equally available to keyboard users.
 * "Fullscreen" expands the existing native dialog rather than creating a
 * second custom overlay with another focus-management implementation.
 */

export interface ZoomOptions {
  signal: AbortSignal;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const BUTTON_STEP = 0.25;

export function initZoomContainers({ signal }: ZoomOptions): void {
  document
    .querySelectorAll<HTMLElement>('.pin-zoom-container')
    .forEach((container) => {
      const wrapperElement =
        container.querySelector<HTMLElement>('.pin-zoom-wrapper');
      if (!wrapperElement) return;
      const wrapper = wrapperElement;

      const dialog = container.closest<HTMLDialogElement>('#pin-modal');
      const hint = container.querySelector<HTMLElement>('.pin-zoom-hint');
      const level =
        container.querySelector<HTMLOutputElement>('.pin-zoom-level');
      const zoomIn = container.querySelector<HTMLButtonElement>('.pin-zoom-in');
      const zoomOut =
        container.querySelector<HTMLButtonElement>('.pin-zoom-out');
      const reset =
        container.querySelector<HTMLButtonElement>('.pin-zoom-reset');
      const fullscreen = container.querySelector<HTMLButtonElement>(
        '.pin-fullscreen-btn',
      );
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

      let scale = MIN_SCALE;
      let panX = 0;
      let panY = 0;
      let dragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let panStartX = 0;
      let panStartY = 0;
      let pinchDistance = 0;
      let pinchX = 0;
      let pinchY = 0;

      function clampScale(value: number) {
        return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
      }

      function applyTransform() {
        if (scale <= MIN_SCALE) {
          scale = MIN_SCALE;
          panX = 0;
          panY = 0;
        }
        wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        container.style.cursor = scale > MIN_SCALE ? 'grab' : 'default';
        if (hint) hint.hidden = scale > MIN_SCALE;
        if (level) level.value = `${Math.round(scale * 100)}%`;
        if (zoomOut) zoomOut.disabled = scale <= MIN_SCALE;
        if (reset) reset.disabled = scale <= MIN_SCALE;
        if (zoomIn) zoomIn.disabled = scale >= MAX_SCALE;
      }

      function transitionTransform() {
        if (reduceMotion) return;
        wrapper.style.transition = 'transform 0.15s ease';
        window.setTimeout(() => {
          wrapper.style.transition = '';
        }, 150);
      }

      function resetZoom() {
        scale = MIN_SCALE;
        panX = 0;
        panY = 0;
        transitionTransform();
        applyTransform();
      }

      function zoomTo(nextScale: number) {
        scale = clampScale(nextScale);
        transitionTransform();
        applyTransform();
      }

      function toggleFullscreen() {
        if (!dialog || !fullscreen) return;
        const enabled = dialog.classList.toggle('pin-fullscreen-mode');
        fullscreen.setAttribute('aria-pressed', String(enabled));
        fullscreen.setAttribute(
          'aria-label',
          enabled ? 'Exit fullscreen pin image' : 'View pin image fullscreen',
        );
      }

      zoomIn?.addEventListener('click', () => zoomTo(scale + BUTTON_STEP), {
        signal,
      });
      zoomOut?.addEventListener('click', () => zoomTo(scale - BUTTON_STEP), {
        signal,
      });
      reset?.addEventListener('click', resetZoom, { signal });
      fullscreen?.addEventListener('click', toggleFullscreen, { signal });

      container.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault();
          const previousScale = scale;
          const nextScale = clampScale(scale * (event.deltaY > 0 ? 0.9 : 1.1));
          const rect = container.getBoundingClientRect();
          const cursorX = event.clientX - rect.left - rect.width / 2;
          const cursorY = event.clientY - rect.top - rect.height / 2;
          panX = cursorX - (cursorX - panX) * (nextScale / previousScale);
          panY = cursorY - (cursorY - panY) * (nextScale / previousScale);
          scale = nextScale;
          applyTransform();
        },
        { signal, passive: false },
      );

      container.addEventListener(
        'dblclick',
        (event) => {
          event.preventDefault();
          if (scale > MIN_SCALE) resetZoom();
          else zoomTo(3);
        },
        { signal },
      );

      container.addEventListener(
        'mousedown',
        (event) => {
          if (scale <= MIN_SCALE) return;
          event.preventDefault();
          dragging = true;
          dragStartX = event.clientX;
          dragStartY = event.clientY;
          panStartX = panX;
          panStartY = panY;
          container.style.cursor = 'grabbing';
        },
        { signal },
      );

      document.addEventListener(
        'mousemove',
        (event) => {
          if (!dragging) return;
          panX = panStartX + event.clientX - dragStartX;
          panY = panStartY + event.clientY - dragStartY;
          applyTransform();
          container.style.cursor = 'grabbing';
        },
        { signal },
      );
      document.addEventListener(
        'mouseup',
        () => {
          dragging = false;
          container.style.cursor = scale > MIN_SCALE ? 'grab' : 'default';
        },
        { signal },
      );

      container.addEventListener(
        'touchstart',
        (event) => {
          if ((event.target as HTMLElement).closest('button')) return;
          if (event.touches.length === 2) {
            event.preventDefault();
            const [first, second] = [event.touches[0], event.touches[1]];
            pinchDistance = Math.hypot(
              second.clientX - first.clientX,
              second.clientY - first.clientY,
            );
            pinchX = (first.clientX + second.clientX) / 2;
            pinchY = (first.clientY + second.clientY) / 2;
          } else if (event.touches.length === 1 && scale > MIN_SCALE) {
            event.preventDefault();
            dragStartX = event.touches[0].clientX;
            dragStartY = event.touches[0].clientY;
            panStartX = panX;
            panStartY = panY;
          }
        },
        { signal, passive: false },
      );

      container.addEventListener(
        'touchmove',
        (event) => {
          if (event.touches.length === 2 && pinchDistance > 0) {
            event.preventDefault();
            const [first, second] = [event.touches[0], event.touches[1]];
            const distance = Math.hypot(
              second.clientX - first.clientX,
              second.clientY - first.clientY,
            );
            const midpointX = (first.clientX + second.clientX) / 2;
            const midpointY = (first.clientY + second.clientY) / 2;
            scale = clampScale(scale * (distance / pinchDistance));
            panX += midpointX - pinchX;
            panY += midpointY - pinchY;
            pinchDistance = distance;
            pinchX = midpointX;
            pinchY = midpointY;
            applyTransform();
          } else if (event.touches.length === 1 && scale > MIN_SCALE) {
            event.preventDefault();
            panX = panStartX + event.touches[0].clientX - dragStartX;
            panY = panStartY + event.touches[0].clientY - dragStartY;
            applyTransform();
          }
        },
        { signal, passive: false },
      );

      dialog?.addEventListener('pin-detail-change', resetZoom, { signal });
      applyTransform();
    });
}
