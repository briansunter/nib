import PhotoSwipe from 'photoswipe';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import { createLightboxHistory, currentHistoryState } from './lightbox-history';

const ZOOM_CLASS = 'pswp-zoomable';

let activeLightbox: PhotoSwipeLightbox | null = null;

function wrapProseImages(root: HTMLElement): number {
  const images = root.querySelectorAll<HTMLImageElement>('img');
  let wrapped = 0;

  images.forEach((img) => {
    if (img.closest('a')) return;
    if (img.closest('.not-prose')) return;
    const src = img.currentSrc || img.src;
    if (!src) return;

    const parent = img.parentElement;
    if (!parent) return;

    const anchor = document.createElement('a');
    anchor.className = ZOOM_CLASS;
    anchor.href = src;
    anchor.dataset.astroPrefetch = 'false';
    const alt = img.alt?.trim();
    anchor.setAttribute(
      'aria-label',
      alt ? `Open image in lightbox: ${alt}` : 'Open image in lightbox',
    );

    parent.insertBefore(anchor, img);
    anchor.appendChild(img);
    wrapped++;
  });

  return wrapped;
}

export function initProseLightbox(): void {
  activeLightbox?.destroy();

  const root = document.querySelector<HTMLElement>('.prose-editorial');
  if (!root) return;

  wrapProseImages(root);
  if (root.querySelector(`a.${ZOOM_CLASS}`) === null) return;

  const lightbox = new PhotoSwipeLightbox({
    gallery: '.prose-editorial',
    children: `a.${ZOOM_CLASS}`,
    pswpModule: PhotoSwipe,
    showHideAnimationType: 'fade',
    bgOpacity: 0.98,
    paddingFn: () => ({ top: 40, bottom: 40, left: 0, right: 0 }),
    clickToCloseNonZoomable: true,
    imageClickAction: 'zoom',
    tapAction: 'zoom',
  });

  activeLightbox = lightbox;

  lightbox.addFilter('domItemData', (itemData, element) => {
    if (!(element instanceof HTMLAnchorElement)) return itemData;
    const img = element.querySelector('img');
    if (img) {
      itemData.width = img.naturalWidth || img.clientWidth || 1600;
      itemData.height = img.naturalHeight || img.clientHeight || 1200;
      if (img.alt) itemData.alt = img.alt;
    }
    return itemData;
  });

  lightbox.on('uiRegister', () => {
    if (!lightbox.pswp?.ui) return;
    lightbox.pswp.ui.registerElement({
      name: 'prose-caption',
      order: 9,
      isButton: false,
      appendTo: 'root',
      onInit: (el) => {
        el.classList.add('pswp__prose-caption');
        const update = () => {
          const alt = lightbox.pswp?.currSlide?.data.alt?.trim() ?? '';
          el.textContent = alt;
          el.hidden = alt.length === 0;
        };
        lightbox.pswp?.on('change', update);
        update();
      },
    });
  });

  let pushedHistoryState = false;
  const lbHistory = createLightboxHistory(lightbox);

  lightbox.on('openingAnimationStart', () => {
    if (!pushedHistoryState) {
      history.pushState({ ...currentHistoryState(), photoswipeOpen: true }, '');
      pushedHistoryState = true;
    }
    lbHistory.attach();
  });

  lightbox.on('close', () => {
    lbHistory.detach();
    if (lbHistory.isClosingFromPopState()) {
      lbHistory.resetClosingFlag();
      pushedHistoryState = false;
      return;
    }
    if (pushedHistoryState) {
      pushedHistoryState = false;
      // Rewind the pushed entry in place (mirrors photoSwipeInitializer). Using
      // replaceState instead of history.back() avoids leaving a stale forward
      // entry and the async popstate that would arrive after detach().
      history.replaceState(
        { ...currentHistoryState(), photoswipeOpen: false },
        '',
      );
    }
  });

  lightbox.on('destroy', () => {
    lbHistory.detach();
    if (activeLightbox === lightbox) {
      activeLightbox = null;
    }
  });

  lightbox.init();
}
