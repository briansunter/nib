import PhotoSwipe from 'photoswipe';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import { trackEvent } from '../lib/analytics';
import { createLightboxHistory, currentHistoryState } from './lightbox-history';

let activeLightbox: PhotoSwipeLightbox | null = null;
let filterRefreshController: AbortController | null = null;
// Slug that the user manually closed during this navigation. Prevents the
// deep-link logic from re-opening the same lightbox after a traversal swap.
let suppressAutoOpenForSlug: string | null = null;
const PHOTOSWIPE_STYLE_ID = 'photoswipe-enhancements-v2';
const URL_PARAM = 'p';
const GALLERY_SELECTORS = ['.art-gallery', '.grid-view', '.list-view'];
const GALLERY_CHILDREN_SELECTOR =
  'a[data-gallery-slug][data-pswp-width][data-pswp-height]:not([data-gallery-hidden])';
const ACTUAL_SIZE_ZOOM = 1;
const ZOOM_EPSILON = 0.01;
const IMAGE_CLICK_DRAG_THRESHOLD = 8;

type FitMode = 'expanded' | 'fullscreen-hidden';

function slugFromAnchor(a: HTMLAnchorElement): string {
  const explicit = a.dataset.gallerySlug;
  if (explicit) return explicit;
  const article = a.closest<HTMLElement>('[data-gallery-slug]');
  if (article?.dataset.gallerySlug) return article.dataset.gallerySlug;
  // Fallback: derive from filename for galleries without explicit slugs.
  try {
    const url = new URL(a.href, window.location.href);
    const filename = decodeURIComponent(url.pathname.split('/').pop() || '');
    const noExt = filename.replace(/\.[^.]+$/, '');
    return noExt.replace(/_[A-Za-z0-9]{6,12}$/, '');
  } catch {
    return '';
  }
}

function findAnchorBySlug(slug: string): HTMLAnchorElement | null {
  for (const sel of GALLERY_SELECTORS) {
    const gallery = document.querySelector(sel);
    if (!gallery || (gallery as HTMLElement).classList.contains('hidden')) {
      continue;
    }
    const match = Array.from(
      gallery.querySelectorAll<HTMLAnchorElement>(GALLERY_CHILDREN_SELECTOR),
    ).find((a) => slugFromAnchor(a) === slug);
    if (match) return match;
  }
  for (const sel of GALLERY_SELECTORS) {
    const gallery = document.querySelector(sel);
    if (!gallery) continue;
    const match = Array.from(
      gallery.querySelectorAll<HTMLAnchorElement>(GALLERY_CHILDREN_SELECTOR),
    ).find((a) => slugFromAnchor(a) === slug);
    if (match) return match;
  }
  return null;
}

function sourceFromPathname() {
  if (window.location.pathname.startsWith('/art')) return 'art';
  if (window.location.pathname.startsWith('/photos')) return 'photos';
  return 'gallery';
}

function trackGalleryPhotoOpen(element: HTMLAnchorElement) {
  const slug = slugFromAnchor(element);
  if (!slug) return;

  const container = element.closest<HTMLElement>('[data-gallery-slug]');
  trackEvent('gallery_photo_open', {
    collection: container?.dataset.collection || 'unknown',
    slug,
    source: sourceFromPathname(),
  });
}

export function initPhotoSwipe() {
  activeLightbox?.destroy();
  filterRefreshController?.abort();
  filterRefreshController = new AbortController();

  window.addEventListener(
    'photo-gallery-filtered',
    () => {
      if (activeLightbox?.pswp?.isOpen) return;
      initPhotoSwipe();
    },
    { signal: filterRefreshController.signal },
  );

  let fitMode: FitMode = 'expanded';
  let previousFitMode: FitMode = 'expanded';
  let isActualSize = false;
  let isZoomedIn = false;
  let actualSizeButton: HTMLButtonElement | null = null;
  let pendingActualSizeIndex: number | null = null;
  const isMobileViewport = () => window.innerWidth < 768;
  const fitPadding = () => {
    const isMobile = isMobileViewport();
    return { top: 40, bottom: isMobile ? 160 : 180, left: 0, right: 0 };
  };
  const zeroPadding = { top: 0, bottom: 0, left: 0, right: 0 };
  const modalIsZoomedIn = () => isActualSize || isZoomedIn;
  const isImmersive = () => modalIsZoomedIn() || fitMode !== 'expanded';
  const isCaptionHidden = () =>
    modalIsZoomedIn() || fitMode === 'fullscreen-hidden';

  const lightbox = new PhotoSwipeLightbox({
    gallery: '.art-gallery, .grid-view, .list-view',
    children: GALLERY_CHILDREN_SELECTOR,
    showHideAnimationType: 'fade',
    pswpModule: PhotoSwipe,
    preloadFirstSlide: true,
    clickToCloseNonZoomable: true,
    imageClickAction: false,
    tapAction: false,
    doubleTapAction: false,
    wheelToZoom: false,
    zoom: false,
    secondaryZoomLevel: ACTUAL_SIZE_ZOOM,
    maxZoomLevel: ACTUAL_SIZE_ZOOM,
    paddingFn: () => (isImmersive() ? zeroPadding : fitPadding()),
    bgOpacity: 0.98,
  });

  activeLightbox = lightbox;

  let pushedHistoryState = false;
  let trackedOpenSlug: string | null = null;
  let lastSlideIndex: number | null = null;
  let imageClickListenerAttached = false;
  let imagePointerStart: { x: number; y: number } | null = null;
  let suppressNextImageClick = false;
  let openingAnimationActive = false;
  let closeAfterOpening = false;
  let closeButtonListenerAttached = false;

  // Back button closes the lightbox instead of navigating away.
  const lbHistory = createLightboxHistory(lightbox);

  const addImageClickListener = () => {
    if (imageClickListenerAttached) return;
    lightbox.pswp?.element?.addEventListener(
      'pointerdown',
      handleImagePointerDown,
      true,
    );
    lightbox.pswp?.element?.addEventListener(
      'pointermove',
      handleImagePointerMove,
      true,
    );
    lightbox.pswp?.element?.addEventListener(
      'pointerup',
      handleImagePointerUp,
      true,
    );
    lightbox.pswp?.element?.addEventListener('click', handleImageClick, true);
    imageClickListenerAttached = true;
  };

  const removeImageClickListener = () => {
    if (!imageClickListenerAttached) return;
    lightbox.pswp?.element?.removeEventListener(
      'pointerdown',
      handleImagePointerDown,
      true,
    );
    lightbox.pswp?.element?.removeEventListener(
      'pointermove',
      handleImagePointerMove,
      true,
    );
    lightbox.pswp?.element?.removeEventListener(
      'pointerup',
      handleImagePointerUp,
      true,
    );
    lightbox.pswp?.element?.removeEventListener(
      'click',
      handleImageClick,
      true,
    );
    imageClickListenerAttached = false;
    imagePointerStart = null;
    suppressNextImageClick = false;
  };

  const currentSlideElement = () =>
    lightbox.pswp?.currSlide?.data?.element as HTMLAnchorElement | undefined;

  const currentSlideSlug = () => {
    const element = currentSlideElement();
    return element ? slugFromAnchor(element) : '';
  };

  const withoutGalleryParam = (source: URL) => {
    const url = new URL(source);
    url.searchParams.delete(URL_PARAM);
    return url;
  };

  const withGalleryParam = (source: URL, slug: string) => {
    const url = new URL(source);
    if (slug) {
      url.searchParams.set(URL_PARAM, slug);
    } else {
      url.searchParams.delete(URL_PARAM);
    }
    return url;
  };

  const replaceModalHistoryWithPlainPage = () => {
    const currentUrl = new URL(window.location.href);
    history.replaceState(
      { ...currentHistoryState(), photoswipeOpen: false },
      '',
      withoutGalleryParam(currentUrl),
    );
  };

  const syncUrlToCurrentSlide = () => {
    const slug = currentSlideSlug();
    if (!slug) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(URL_PARAM) !== slug) {
      history.replaceState(history.state, '', withGalleryParam(url, slug));
    }
  };

  lightbox.on('openingAnimationStart', () => {
    openingAnimationActive = true;

    if (!pushedHistoryState) {
      const currentState = currentHistoryState();
      const slug = currentSlideSlug();
      const currentUrl = new URL(window.location.href);
      const plainUrl = withoutGalleryParam(currentUrl);
      const modalUrl = withGalleryParam(currentUrl, slug);

      if (currentUrl.searchParams.has(URL_PARAM)) {
        history.replaceState(
          { ...currentState, photoswipeOpen: false },
          '',
          plainUrl,
        );
      }

      history.pushState(
        { ...currentState, photoswipeOpen: true },
        '',
        modalUrl,
      );
      pushedHistoryState = true;
    }

    lbHistory.attach();
    syncUrlToCurrentSlide();

    const element = currentSlideElement();
    if (element) {
      const slug = slugFromAnchor(element);
      if (slug && slug !== trackedOpenSlug) {
        trackedOpenSlug = slug;
        trackGalleryPhotoOpen(element);
      }
    }
  });

  lightbox.on('close', () => {
    lbHistory.detach();

    if (lbHistory.isClosingFromPopState()) {
      lbHistory.resetClosingFlag();
      pushedHistoryState = false;
      trackedOpenSlug = null;
      return;
    }

    if (pushedHistoryState) {
      pushedHistoryState = false;
      replaceModalHistoryWithPlainPage();
    }

    suppressAutoOpenForSlug = null;
    trackedOpenSlug = null;
  });

  // Pending deep-link synthetic-click timer; cleared on destroy so a re-init
  // (filter event / HMR / view-transition swap) cannot fire a stale click.
  let deepLinkTimer: ReturnType<typeof setTimeout> | undefined;

  lightbox.on('destroy', () => {
    lbHistory.detach();
    if (deepLinkTimer !== undefined) {
      clearTimeout(deepLinkTimer);
      deepLinkTimer = undefined;
    }
    if (activeLightbox === lightbox) {
      activeLightbox = null;
    }
  });

  const slideCanZoomToActualSize = () => {
    const slide = lightbox.pswp?.currSlide;
    if (!slide?.isZoomable()) return false;
    return ACTUAL_SIZE_ZOOM > slide.zoomLevels.initial + ZOOM_EPSILON;
  };

  const slideIsAtActualSize = () => {
    const slide = lightbox.pswp?.currSlide;
    if (!slide) return false;
    return (
      slide.currZoomLevel >= ACTUAL_SIZE_ZOOM - ZOOM_EPSILON &&
      slideCanZoomToActualSize()
    );
  };

  const slideIsZoomedIn = () => {
    const slide = lightbox.pswp?.currSlide;
    if (!slide) return false;
    return slide.currZoomLevel > slide.zoomLevels.initial + ZOOM_EPSILON;
  };

  const slideHasMountedContent = () => {
    const slide = lightbox.pswp?.currSlide;
    const contentElement = slide?.content?.element;
    return Boolean(
      contentElement instanceof HTMLElement &&
        contentElement.parentElement === slide?.container,
    );
  };

  const updateActualSizeButton = () => {
    if (!actualSizeButton) return;
    const canZoom = slideCanZoomToActualSize();
    actualSizeButton.disabled = !canZoom;
    actualSizeButton.setAttribute(
      'aria-label',
      modalIsZoomedIn() ? 'Return to fit view' : 'Zoom to actual size',
    );
    actualSizeButton.title = modalIsZoomedIn()
      ? 'Return to fit view'
      : 'Zoom to actual size';
  };

  const applyModalState = (updateSize = true) => {
    const root = lightbox.pswp?.element;
    if (!root) return;
    root.dataset.galleryModalState = isActualSize ? 'actual-size' : fitMode;
    root.classList.toggle('pswp--modal-expanded', fitMode === 'expanded');
    root.classList.toggle(
      'pswp--fullscreen-hidden',
      fitMode === 'fullscreen-hidden' && !isActualSize,
    );
    root.classList.toggle('pswp--immersive', isImmersive());
    root.classList.toggle('pswp--caption-hidden', isCaptionHidden());
    root.classList.toggle('pswp--zoomed-in', modalIsZoomedIn());
    root.classList.toggle('pswp--actual-size', isActualSize);
    root.classList.toggle(
      'pswp--actual-size-unavailable',
      !slideCanZoomToActualSize(),
    );
    updateActualSizeButton();
    if (updateSize) {
      lightbox.pswp?.updateSize(true);
    }
  };

  const syncActualSizeFromSlide = () => {
    const nextActualSize = slideIsAtActualSize();
    const nextZoomedIn = nextActualSize || slideIsZoomedIn();
    if (nextActualSize === isActualSize && nextZoomedIn === isZoomedIn) {
      updateActualSizeButton();
      return;
    }
    if (nextActualSize) {
      previousFitMode = fitMode;
    }
    isActualSize = nextActualSize;
    isZoomedIn = nextZoomedIn;
    applyModalState(false);
  };

  const setFitMode = (next: FitMode) => {
    if (fitMode !== next) {
      fitMode = next;
      previousFitMode = next;
      applyModalState();
    }
  };

  const applyActualSizeZoom = (transitionDuration: number | false) => {
    const pswp = lightbox.pswp;
    const slide = pswp?.currSlide;
    if (!pswp || !slide || !slideCanZoomToActualSize()) return false;
    previousFitMode = fitMode;
    isActualSize = true;
    isZoomedIn = true;
    pendingActualSizeIndex = null;
    applyModalState();
    slide.zoomTo(
      ACTUAL_SIZE_ZOOM,
      pswp.getViewportCenterPoint(),
      transitionDuration,
    );
    applyModalState(false);
    return true;
  };

  const tryPendingActualSizeZoom = (transitionDuration: number | false = 0) => {
    const pswp = lightbox.pswp;
    if (!pswp || pendingActualSizeIndex !== pswp.currIndex) return false;
    pswp.currSlide?.appendHeavy();
    if (!slideHasMountedContent()) return false;
    return applyActualSizeZoom(transitionDuration);
  };

  const zoomToActualSize = () => {
    const pswp = lightbox.pswp;
    if (!pswp?.currSlide || !slideCanZoomToActualSize()) return;
    pendingActualSizeIndex = pswp.currIndex;
    if (tryPendingActualSizeZoom(pswp.options.zoomAnimationDuration)) return;
    window.requestAnimationFrame(() => {
      tryPendingActualSizeZoom(pswp.options.zoomAnimationDuration);
    });
  };

  const restoreFitView = () => {
    const pswp = lightbox.pswp;
    const slide = pswp?.currSlide;
    if (!pswp || !slide) return;
    pendingActualSizeIndex = null;
    isActualSize = false;
    isZoomedIn = false;
    fitMode = previousFitMode;
    applyModalState();
    slide.zoomTo(
      slide.zoomLevels.initial,
      pswp.getViewportCenterPoint(),
      pswp.options.zoomAnimationDuration,
    );
    applyModalState(false);
  };

  const resetCurrentSlideZoom = () => {
    const pswp = lightbox.pswp;
    const slide = pswp?.currSlide;
    if (!pswp || !slide?.isZoomable()) return;
    if (
      Math.abs(slide.currZoomLevel - slide.zoomLevels.initial) <= ZOOM_EPSILON
    ) {
      return;
    }
    slide.zoomTo(slide.zoomLevels.initial, pswp.getViewportCenterPoint(), 0);
  };

  const toggleActualSize = () => {
    if (modalIsZoomedIn()) {
      restoreFitView();
    } else {
      zoomToActualSize();
    }
  };

  const toggleFullscreenFit = () => {
    setFitMode(fitMode === 'expanded' ? 'fullscreen-hidden' : 'expanded');
  };

  const isImageInteractionTarget = (target: HTMLElement | null) => {
    if (!target) return false;
    const onImage = target.closest(
      '.pswp__img, .pswp__zoom-wrap, .pswp__container',
    );
    if (!onImage) return false;
    return !target.closest('button, a, .pswp__top-bar');
  };

  const handleImagePointerDown = (e: PointerEvent) => {
    if (!isImageInteractionTarget(e.target as HTMLElement | null)) return;
    imagePointerStart = { x: e.clientX, y: e.clientY };
    suppressNextImageClick = false;
  };

  const handleImagePointerMove = (e: PointerEvent) => {
    if (!imagePointerStart) return;
    const moved =
      Math.abs(e.clientX - imagePointerStart.x) +
      Math.abs(e.clientY - imagePointerStart.y);
    if (moved > IMAGE_CLICK_DRAG_THRESHOLD) {
      suppressNextImageClick = true;
    }
  };

  const handleImagePointerUp = () => {
    imagePointerStart = null;
    window.setTimeout(() => {
      suppressNextImageClick = false;
    }, 0);
  };

  const handleImageClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!isImageInteractionTarget(target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (suppressNextImageClick) {
      suppressNextImageClick = false;
      return;
    }
    toggleActualSize();
  };

  const handleCloseButtonClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.pswp__button--close')) return;
    if (!openingAnimationActive) return;

    closeAfterOpening = true;
    e.preventDefault();
    e.stopPropagation();
  };

  const addCloseButtonListener = () => {
    if (closeButtonListenerAttached) return;
    lightbox.pswp?.element?.addEventListener(
      'click',
      handleCloseButtonClick,
      true,
    );
    closeButtonListenerAttached = true;
  };

  const removeCloseButtonListener = () => {
    if (!closeButtonListenerAttached) return;
    lightbox.pswp?.element?.removeEventListener(
      'click',
      handleCloseButtonClick,
      true,
    );
    closeButtonListenerAttached = false;
  };

  lightbox.on('afterInit', () => {
    fitMode = 'expanded';
    previousFitMode = 'expanded';
    isActualSize = false;
    isZoomedIn = false;
    pendingActualSizeIndex = null;
    lastSlideIndex = lightbox.pswp?.currIndex ?? null;
    openingAnimationActive = false;
    closeAfterOpening = false;
    applyModalState(false);
    addImageClickListener();
    addCloseButtonListener();
  });

  lightbox.on('close', () => {
    removeImageClickListener();
    removeCloseButtonListener();
    fitMode = 'expanded';
    previousFitMode = 'expanded';
    isActualSize = false;
    isZoomedIn = false;
    pendingActualSizeIndex = null;
    actualSizeButton = null;
    lastSlideIndex = null;
    openingAnimationActive = false;
    closeAfterOpening = false;
  });

  lightbox.on('change', () => {
    const currentIndex = lightbox.pswp?.currIndex ?? null;
    if (currentIndex === lastSlideIndex) {
      applyModalState(false);
      return;
    }
    lastSlideIndex = currentIndex;
    previousFitMode = fitMode;
    isActualSize = false;
    isZoomedIn = false;
    pendingActualSizeIndex = null;
    applyModalState();
    resetCurrentSlideZoom();
    applyModalState(false);
  });

  lightbox.on('appendHeavyContent', () => {
    tryPendingActualSizeZoom(0);
  });
  lightbox.on('contentAppendImage', () => {
    tryPendingActualSizeZoom(0);
  });
  lightbox.on('loadComplete', () => {
    tryPendingActualSizeZoom(0);
  });

  lightbox.on('zoomPanUpdate', syncActualSizeFromSlide);
  lightbox.on('initialZoomPan', syncActualSizeFromSlide);

  lightbox.on('uiRegister', () => {
    if (!lightbox.pswp?.ui) return;

    lightbox.pswp.ui.registerElement({
      name: 'fit-fullscreen',
      order: 11,
      isButton: true,
      ariaLabel: 'Toggle full-height view',
      html: `
        <svg class="pswp__icn pswp__icn--fit-expand" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            d="M11 5H7a2 2 0 0 0-2 2v4 M21 5h4a2 2 0 0 1 2 2v4 M11 27H7a2 2 0 0 1-2-2v-4 M21 27h4a2 2 0 0 0 2-2v-4"/>
        </svg>
        <svg class="pswp__icn pswp__icn--fit-collapse" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            d="M5 11h4a2 2 0 0 0 2-2V5 M27 11h-4a2 2 0 0 1-2-2V5 M5 21h4a2 2 0 0 1 2 2v4 M27 21h-4a2 2 0 0 0-2 2v4"/>
        </svg>
      `,
      onClick: () => {
        toggleFullscreenFit();
      },
    });

    lightbox.pswp.ui.registerElement({
      name: 'actual-size',
      order: 10,
      isButton: true,
      ariaLabel: 'Zoom to actual size',
      html: `
        <svg class="pswp__icn pswp__icn--actual-plus" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            d="m22 22 5 5 M14 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"/>
          <path class="pswp__icn-detail" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            d="M14 11.25v5.5 M11.25 14h5.5"/>
        </svg>
        <svg class="pswp__icn pswp__icn--actual-minus" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            d="m22 22 5 5 M14 7a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"/>
          <path class="pswp__icn-detail" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            d="M11.25 14h5.5"/>
        </svg>
      `,
      onInit: (el: HTMLElement) => {
        actualSizeButton = el as HTMLButtonElement;
        updateActualSizeButton();
      },
      onClick: () => {
        toggleActualSize();
      },
    });

    lightbox.pswp.ui.registerElement({
      name: 'custom-caption',
      order: 9,
      isButton: false,
      appendTo: 'root',
      html: 'Caption text',
      onInit: (el: HTMLElement) => {
        if (!lightbox.pswp) return;

        lightbox.pswp.on('change', () => {
          if (!lightbox.pswp?.currSlide?.data.element) return;

          const currSlideElement = lightbox.pswp.currSlide.data.element;

          // Get caption from the closest article or photo container
          const container = currSlideElement.closest(
            'article, .photo-container',
          ) as HTMLElement | null;
          if (container) {
            // Clear existing content safely
            el.innerHTML = '';

            // Get metadata elements
            const titleEl = container.querySelector(
              '[data-photo-title]',
            ) as HTMLElement | null;
            const locationEl = container.querySelector(
              '[data-photo-location]',
            ) as HTMLElement | null;
            const mediumEl = container.querySelector(
              '[data-photo-medium]',
            ) as HTMLElement | null;
            const dateEl = container.querySelector(
              '[data-photo-date]',
            ) as HTMLElement | null;
            const collectionEl = container.querySelector(
              '[data-photo-collection]',
            ) as HTMLElement | null;
            const descriptionEl = container.querySelector(
              '[data-photo-description]',
            ) as HTMLElement | null;
            const dimensionsEl = container.querySelector(
              '[data-photo-dimensions]',
            ) as HTMLElement | null;
            const surfaceEl = container.querySelector(
              '[data-photo-surface]',
            ) as HTMLElement | null;

            // Create content wrapper
            const content = document.createElement('div');
            content.className = 'pswp__caption-content';

            // Add title if exists (using textContent for XSS safety)
            if (titleEl?.textContent) {
              const title = document.createElement('h3');
              title.className = 'pswp__caption-title';
              title.textContent = titleEl.textContent;
              content.appendChild(title);
            }

            // Add metadata row
            const meta = document.createElement('div');
            meta.className = 'pswp__caption-meta';

            const addMetaItem = (text: string | null | undefined) => {
              if (!text) return;
              const trimmedText = text.trim();
              if (!trimmedText) return;
              if (meta.children.length > 0) {
                const dot = document.createElement('span');
                dot.className = 'pswp__caption-dot';
                dot.textContent = '•';
                meta.appendChild(dot);
              }
              const span = document.createElement('span');
              span.textContent = trimmedText;
              meta.appendChild(span);
            };

            addMetaItem(locationEl?.textContent);
            addMetaItem(mediumEl?.textContent);
            addMetaItem(dateEl?.textContent);
            addMetaItem(
              collectionEl?.textContent ?? container.dataset.collection,
            );
            addMetaItem(surfaceEl?.textContent);
            addMetaItem(dimensionsEl?.textContent);

            if (meta.children.length > 0) {
              content.appendChild(meta);
            }

            // Add description if exists (using textContent for XSS safety)
            if (descriptionEl?.textContent) {
              const desc = document.createElement('div');
              desc.className = 'pswp__caption-description';
              desc.textContent = descriptionEl.textContent;
              content.appendChild(desc);
            }

            el.appendChild(content);
          } else {
            el.innerHTML = '';
          }
        });
      },
    });
  });

  // Always re-inject custom styles so updated rules win on HMR / view transitions.
  document.getElementById(PHOTOSWIPE_STYLE_ID)?.remove();
  {
    const newStyle = document.createElement('style');
    newStyle.id = PHOTOSWIPE_STYLE_ID;
    newStyle.textContent = `
    .pswp--caption-hidden .pswp__caption-content,
    .pswp--zoomed-in .pswp__caption-content {
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px);
    }
    .pswp__button--fit-fullscreen .pswp__icn--fit-collapse { display: none; }
    .pswp.pswp--immersive .pswp__button--fit-fullscreen .pswp__icn--fit-expand { display: none; }
    .pswp.pswp--immersive .pswp__button--fit-fullscreen .pswp__icn--fit-collapse { display: inline-block; }
    .pswp__button--actual-size .pswp__icn--actual-minus { display: none; }
    .pswp.pswp--zoomed-in .pswp__button--actual-size .pswp__icn--actual-plus { display: none; }
    .pswp.pswp--zoomed-in .pswp__button--actual-size .pswp__icn--actual-minus { display: inline-block; }
    .pswp.pswp--actual-size-unavailable .pswp__button--actual-size {
      opacity: 0.48 !important;
      pointer-events: none;
    }
    .pswp__button--actual-size,
    .pswp__button--fit-fullscreen {
      color: #fff !important;
      opacity: 1 !important;
      background: none !important;
      border: 0 !important;
      box-shadow: none !important;
      outline: 0 !important;
    }
    .pswp__button--actual-size .pswp__icn,
    .pswp__button--fit-fullscreen .pswp__icn {
      color: #fff !important;
      opacity: 1 !important;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));
    }
    .pswp__button--actual-size .pswp__icn path,
    .pswp__button--fit-fullscreen .pswp__icn path {
      stroke-width: 2.75px;
    }
    .pswp__button--actual-size .pswp__icn .pswp__icn-detail {
      stroke-width: 2.25px;
    }
    .pswp:not(.pswp--zoomed-in) .pswp__container,
    .pswp:not(.pswp--zoomed-in) .pswp__zoom-wrap,
    .pswp:not(.pswp--zoomed-in) .pswp__img {
      cursor: -webkit-zoom-in !important;
      cursor: -moz-zoom-in !important;
      cursor: zoom-in !important;
    }
    .pswp.pswp--zoomed-in .pswp__container,
    .pswp.pswp--zoomed-in .pswp__zoom-wrap,
    .pswp.pswp--zoomed-in .pswp__img {
      cursor: -webkit-zoom-out !important;
      cursor: -moz-zoom-out !important;
      cursor: zoom-out !important;
    }
    .pswp__caption-content {
      transition: opacity 0.18s ease, transform 0.18s ease;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-width: 100%;
      max-height: 150px;
      overflow-y: auto;
      margin: 0;
      padding: 1rem 1.5rem calc(1rem + env(safe-area-inset-bottom, 0px));
      text-align: left;
      background: linear-gradient(to top,
        rgba(0,0,0,0.95) 0%,
        rgba(0,0,0,0.9) 60%,
        rgba(0,0,0,0.7) 85%,
        rgba(0,0,0,0) 100%);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: none;
      transform: none;
      z-index: 9999;
      pointer-events: auto;
      -webkit-overflow-scrolling: touch;
    }
    @media (min-width: 768px) {
      .pswp__caption-content {
        max-height: 170px;
        padding: 1.5rem 1.5rem 1.25rem;
      }
    }
    .pswp__caption-title {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 1rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 0.375rem;
      line-height: 1.3;
      letter-spacing: -0.01em;
    }
    @media (min-width: 768px) {
      .pswp__caption-title {
        font-size: 1.25rem;
        margin-bottom: 0.5rem;
      }
    }
    .pswp__caption-meta {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: rgba(255, 255, 255, 0.75);
      font-size: 0.75rem;
      margin-bottom: 0.5rem;
      letter-spacing: 0.01em;
      flex-wrap: wrap;
    }
    @media (min-width: 768px) {
      .pswp__caption-meta {
        gap: 0.75rem;
        font-size: 0.875rem;
        margin-bottom: 0.625rem;
      }
    }
    .pswp__caption-dot {
      opacity: 0.3;
    }
    .pswp__caption-description {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.8125rem;
      line-height: 1.5;
      letter-spacing: 0.01em;
      max-width: 100%;
      white-space: pre-line;
    }
    @media (min-width: 768px) {
      .pswp__caption-description {
        font-size: 0.875rem;
        line-height: 1.6;
        max-width: 65ch;
      }
    }
    .pswp__bg {
      background: rgba(0, 0, 0, 0.95);
    }
    .pswp__top-bar {
      background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%) !important;
      padding-top: env(safe-area-inset-top, 0px);
    }
    .pswp {
      z-index: 10000 !important;
    }

    /* Subtle swipe indicators */
    .pswp__swipe-indicator {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 44px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
      z-index: 10;
    }
    .pswp__swipe-indicator--left {
      left: 8px;
    }
    .pswp__swipe-indicator--right {
      right: 8px;
    }
    .pswp__swipe-indicator svg {
      width: 28px;
      height: 28px;
      color: rgba(255, 255, 255, 0.6);
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
    }
    @media (min-width: 768px) {
      .pswp__swipe-indicator {
        width: 60px;
        height: 100px;
      }
      .pswp__swipe-indicator svg {
        width: 36px;
        height: 36px;
      }
    }
    .pswp__swipe-indicator.visible {
      opacity: 1;
    }

    /* Navigation arrows - better mobile touch targets */
    .pswp__button--arrow {
      width: 50px !important;
      height: 80px !important;
    }
    @media (max-width: 767px) {
      .pswp__button--arrow {
        display: none !important;
      }
    }

    /* Mobile: Counter indicator at top */
    .pswp__counter {
      font-size: 0.875rem !important;
      padding: 0.5rem 1rem !important;
      opacity: 0.8;
    }
  `;
    document.head.appendChild(newStyle);
  }

  // Add swipe indicators
  lightbox.on('openingAnimationEnd', () => {
    if (!lightbox.pswp) return;
    openingAnimationActive = false;

    if (closeAfterOpening) {
      closeAfterOpening = false;
      lightbox.pswp.close();
      return;
    }

    const container = lightbox.pswp.element;
    if (!container) return;

    // Create left indicator
    const leftIndicator = document.createElement('div');
    leftIndicator.className =
      'pswp__swipe-indicator pswp__swipe-indicator--left';
    leftIndicator.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>`;

    // Create right indicator
    const rightIndicator = document.createElement('div');
    rightIndicator.className =
      'pswp__swipe-indicator pswp__swipe-indicator--right';
    rightIndicator.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`;

    container.appendChild(leftIndicator);
    container.appendChild(rightIndicator);

    // Show indicators briefly on open
    const showIndicators = () => {
      const itemCount = lightbox.pswp?.getNumItems() || 0;
      const currentIndex = lightbox.pswp?.currIndex || 0;

      if (currentIndex > 0) {
        leftIndicator.classList.add('visible');
      }
      if (currentIndex < itemCount - 1) {
        rightIndicator.classList.add('visible');
      }

      setTimeout(() => {
        leftIndicator.classList.remove('visible');
        rightIndicator.classList.remove('visible');
      }, 1500);
    };

    showIndicators();

    // Update on slide change
    lightbox.pswp?.on('change', showIndicators);
    lightbox.pswp?.on('change', syncUrlToCurrentSlide);
  });

  lightbox.init();

  // Deep-link: open the photo matching ?p=<slug> on initial load.
  const initialUrl = new URL(window.location.href);
  const initialSlug = initialUrl.searchParams.get(URL_PARAM);
  if (initialSlug === suppressAutoOpenForSlug) {
    // The user just closed this slug; consume the suppression so a fresh
    // navigation later can re-trigger the deep-link.
    suppressAutoOpenForSlug = null;
  } else if (initialSlug) {
    // Dispatch a synthetic click on the matching anchor - this routes through
    // PhotoSwipe's existing click handler, which knows how to open the right
    // gallery without us reaching for the loadAndOpen API surface. Wait one
    // tick so the lightbox's delegated click listeners are fully attached
    // (init() in the same frame can race with HMR/view-transition reentry).
    deepLinkTimer = setTimeout(() => {
      deepLinkTimer = undefined;
      const anchor = findAnchorBySlug(initialSlug);
      if (!anchor) {
        initialUrl.searchParams.delete(URL_PARAM);
        history.replaceState(history.state, '', initialUrl);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + 1,
        clientY: rect.top + 1,
      });
      anchor.dispatchEvent(event);
    }, 100);
  }
}
