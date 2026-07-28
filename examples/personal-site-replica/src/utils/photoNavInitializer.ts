import { initDropdownDismissal, setupDropdown } from './dropdown';

let navController: AbortController | null = null;

function invalidateVisibleMapsIfPresent(invalidateMaps?: () => void) {
  if (!document.querySelector('.map-element')) return;
  invalidateMaps?.();
}

export function initPhotoNav(options: { invalidateMaps?: () => void } = {}) {
  destroyPhotoNav();
  navController = new AbortController();
  const { signal } = navController;

  // Elements for sticky behavior
  const bsLogo = document.getElementById('bs-logo');
  const navWrapper = document.getElementById('photo-nav-wrapper');
  const nav = document.getElementById('collection-nav');
  const placeholder = document.getElementById('nav-placeholder');

  // Threshold for showing BS logo - when nav is stuck at top
  const LOGO_SHOW_THRESHOLD = 50;

  function updateNavState() {
    if (!nav || !placeholder || !navWrapper) return;

    // Check if nav wrapper is at or near top of viewport (meaning it's stuck)
    const navRect = navWrapper.getBoundingClientRect();
    const isStuck = navRect.top <= 0;

    // Make nav fixed when wrapper reaches top
    if (isStuck) {
      nav.classList.add('is-fixed');
      placeholder.classList.add('active');
    } else {
      nav.classList.remove('is-fixed');
      placeholder.classList.remove('active');
    }

    // BS Logo visibility - show when scrolled past threshold, hide only near top
    if (bsLogo) {
      if (window.scrollY > LOGO_SHOW_THRESHOLD) {
        bsLogo.classList.add('visible');
      } else {
        bsLogo.classList.remove('visible');
      }
    }
  }

  // Recalculate on resize
  window.addEventListener(
    'resize',
    () => {
      nav?.classList.remove('is-fixed');
      placeholder?.classList.remove('active');
      updateNavState();
    },
    { signal },
  );

  // Throttle the scroll handler with rAF so the getBoundingClientRect read in
  // updateNavState does not force synchronous layout on every scroll event.
  let scrollTicking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      window.requestAnimationFrame(() => {
        updateNavState();
        scrollTicking = false;
      });
    },
    { passive: true, signal },
  );
  updateNavState();

  setupDropdown('collection-dropdown-btn', 'collection-dropdown-menu', {
    signal,
  });
  setupDropdown('filter-dropdown-btn', 'filter-dropdown-menu', { signal });
  initDropdownDismissal({ signal });

  // Collection selection
  document
    .querySelectorAll('#collection-dropdown-menu .dropdown-option')
    .forEach((option) => {
      option.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          const target = e.currentTarget as HTMLElement;
          const name = target.dataset.collectionName;
          const collectionId = target.dataset.collectionId;
          const selectedName = document.getElementById(
            'selected-collection-name',
          );
          if (selectedName && name) selectedName.textContent = name;

          document
            .querySelectorAll('#collection-dropdown-menu .dropdown-option')
            .forEach((o) => {
              o.classList.remove('active');
            });
          target.classList.add('active');
          document
            .getElementById('collection-dropdown-menu')
            ?.classList.remove('open');
          document
            .getElementById('collection-dropdown-btn')
            ?.setAttribute('aria-expanded', 'false');

          if (collectionId) {
            const targetSection = document.getElementById(collectionId);
            targetSection?.scrollIntoView({ block: 'start' });

            if (targetSection) {
              const url = new URL(window.location.href);
              url.hash = collectionId;
              history.replaceState(history.state, '', url);
            }
          }
        },
        { signal },
      );
    });

  function updateFilterOptionState(target: HTMLElement, selected: boolean) {
    target.classList.toggle('selected', selected);
    target.setAttribute('aria-pressed', String(selected));
    target.querySelector('.check-icon')?.classList.toggle('hidden', !selected);
    target.querySelector('.check-box')?.classList.toggle('bg-ink', selected);
    target
      .querySelector('.check-box')
      ?.classList.toggle('border-ink', selected);
  }

  document
    .querySelectorAll(
      '#filter-dropdown-menu .location-option, #filter-dropdown-menu .medium-option, #filter-dropdown-menu .tag-option',
    )
    .forEach((option) => {
      option.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          const target = e.currentTarget as HTMLElement;
          updateFilterOptionState(
            target,
            !target.classList.contains('selected'),
          );
          window.dispatchEvent(new CustomEvent('photo-filter-update'));
        },
        { signal },
      );
    });

  // Clear all filters
  document.getElementById('clear-all-filters')?.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Uncheck all
      document
        .querySelectorAll('#filter-dropdown-menu .selected')
        .forEach((el) => {
          updateFilterOptionState(el as HTMLElement, false);
        });

      // Trigger filter update
      window.dispatchEvent(new CustomEvent('photo-filter-update'));
    },
    { signal },
  );

  function selectedFilterValues(
    selector: string,
    dataKey: 'location' | 'medium' | 'tag',
  ): string[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>(selector),
      (el) => el.dataset[dataKey],
    ).filter((value): value is string => Boolean(value));
  }

  // View toggle
  document
    .querySelectorAll('.photo-nav-view-toggle .view-btn')
    .forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          const view = (btn as HTMLElement).dataset.view;
          document
            .querySelectorAll('.photo-nav-view-toggle .view-btn')
            .forEach((b) => {
              const isActive = b === btn;
              b.classList.toggle('active', isActive);
              b.setAttribute('aria-pressed', String(isActive));
            });

          const photoGallery = document.querySelector('.photo-gallery');
          const artGallery = document.querySelector('.art-gallery');
          if (view === 'grid' || view === 'list') {
            photoGallery?.setAttribute('data-view', view);
            artGallery?.setAttribute('data-view', view);
          }

          // Invalidate map sizes after view change (maps need recalculation when shown)
          requestAnimationFrame(() => {
            invalidateVisibleMapsIfPresent(options.invalidateMaps);
          });
        },
        { signal },
      );
    });

  // Gallery filter update handler (multi-select)
  window.addEventListener(
    'photo-filter-update',
    (() => {
      const selectedLocations = selectedFilterValues(
        '#filter-dropdown-menu .location-option.selected',
        'location',
      );
      const selectedMediums = selectedFilterValues(
        '#filter-dropdown-menu .medium-option.selected',
        'medium',
      );
      const selectedTags = selectedFilterValues(
        '#filter-dropdown-menu .tag-option.selected',
        'tag',
      );

      const totalFilters =
        selectedLocations.length + selectedMediums.length + selectedTags.length;

      // Show/hide clear all button
      const clearBtn = document.getElementById('clear-all-filters');
      const clearDivider = document.getElementById('clear-divider');
      clearBtn?.classList.toggle('hidden', totalFilters === 0);
      clearDivider?.classList.toggle('hidden', totalFilters === 0);

      // Update filter count badge
      const filterCount = document.getElementById('filter-count');
      if (filterCount) {
        filterCount.textContent = totalFilters.toString();
        filterCount.classList.toggle('hidden', totalFilters === 0);
      }

      // Both gallery types render each item once and switch layout with data-view.
      const galleryItems =
        document.querySelectorAll<HTMLElement>('.photo-container');
      const visibleGallerySlugs = new Set<string>();
      let visibleItemsWithoutSlug = 0;

      galleryItems.forEach((el) => {
        const itemLocation = el.dataset.location || '';
        const itemMedium = el.dataset.medium || '';
        const itemTags = el.dataset.tags?.split(',').filter(Boolean) || [];

        // Check if item matches filters (OR logic within category, AND between categories)
        const locationMatch =
          selectedLocations.length === 0 ||
          selectedLocations.includes(itemLocation);
        const mediumMatch =
          selectedMediums.length === 0 || selectedMediums.includes(itemMedium);
        const tagMatch =
          selectedTags.length === 0 ||
          selectedTags.some((t) => itemTags.includes(t));

        const isVisible = locationMatch && mediumMatch && tagMatch;
        el.hidden = !isVisible;
        el.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
          anchor.toggleAttribute('data-gallery-hidden', !isVisible);
        });
        if (isVisible) {
          const stableSlug = el.dataset.gallerySlug;
          if (stableSlug) {
            visibleGallerySlugs.add(stableSlug);
          } else {
            visibleItemsWithoutSlug++;
          }
        }
      });

      // Hide collection sections with no visible items
      document.querySelectorAll('.collection-section').forEach((section) => {
        const sectionEl = section as HTMLElement;
        const visiblePhotos = sectionEl.querySelectorAll(
          '.photo-container:not([hidden])',
        );
        sectionEl.hidden = visiblePhotos.length === 0;
      });

      // Update visible count. Stable slugs protect against malformed duplicate data.
      const countEl = document.getElementById('visible-count');
      if (countEl) {
        countEl.textContent = (
          visibleGallerySlugs.size + visibleItemsWithoutSlug
        ).toString();
      }

      // Update filter button style
      const filterBtn = document.getElementById('filter-dropdown-btn');
      filterBtn?.classList.toggle('filter-active', totalFilters > 0);

      window.dispatchEvent(new CustomEvent('photo-gallery-filtered'));
    }) as EventListener,
    { signal },
  );
}

export function destroyPhotoNav() {
  navController?.abort();
  navController = null;
}
