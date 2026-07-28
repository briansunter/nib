/**
 * Filter & sort logic for the pin collection grid. Extracted from
 * `src/utils/pinCollectionInitializer.ts`.
 *
 * Owns: search input, category buttons, tag buttons, favourites toggle,
 * sort dropdown options, clear/reset buttons, and the
 * `applyFilters` / `sortCards` pipeline that toggles per-card visibility.
 */

import { trackEvent } from '../../lib/analytics';

export type SortKey = 'newest' | 'oldest' | 'name' | 'category';

export const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  name: 'Name A-Z',
  category: 'Category',
};

export interface FilterSortOptions {
  signal: AbortSignal;
  /**
   * Optional callback fired after `applyFilters` runs (e.g. so callers can
   * react to a new visible-pin set). Currently unused by the orchestrator
   * because consumers query `getVisiblePinIds` lazily, but kept to keep the
   * API extensible.
   */
  onChange?: () => void;
}

export interface FilterSortHandle {
  getCurrentSort(): SortKey;
  getActiveCategory(): string;
  getSelectedTags(): ReadonlySet<string>;
  applyFilters(): void;
  resetFilters(): void;
  /**
   * Returns the ordered list of `data-pin-id` values currently visible in
   * the grid. Used by the modal-navigation module to know what set of pins
   * to step through.
   */
  getVisiblePinIds(): string[];
}

function normalize(value: string | undefined): string {
  return (value ?? '').toLowerCase().trim();
}

export function initFilterSort(options: FilterSortOptions): FilterSortHandle {
  const { signal, onChange } = options;
  const grid = document.getElementById('pin-grid');
  const searchInput = document.getElementById(
    'pin-search-input',
  ) as HTMLInputElement | null;
  const favoritesToggle = document.getElementById('favorites-toggle');
  const clearFiltersButtons = [
    document.getElementById('pin-reset-filters'),
    document.getElementById('pin-clear-filters'),
  ].filter((button): button is HTMLElement => Boolean(button));
  const categoryButtons = [
    ...document.querySelectorAll('.category-filter[data-category]'),
  ] as HTMLElement[];
  const tagButtons = [
    ...document.querySelectorAll('.tag-filter[data-tag]'),
  ] as HTMLElement[];
  const sortOptions = [
    ...document.querySelectorAll('.sort-option[data-sort]'),
  ] as HTMLElement[];

  let activeCategory = 'all';
  const selectedTags = new Set<string>();
  let currentSort: SortKey = 'newest';
  let searchTrackTimer: number | null = null;

  function getPinCards(): HTMLElement[] {
    return [
      ...document.querySelectorAll('#pin-grid .pin-card'),
    ] as HTMLElement[];
  }

  function hasActiveFilters(): boolean {
    return (
      normalize(searchInput?.value) !== '' ||
      activeCategory !== 'all' ||
      selectedTags.size > 0 ||
      favoritesToggle?.getAttribute('aria-pressed') === 'true'
    );
  }

  function setPressed(button: HTMLElement, pressed: boolean) {
    button.setAttribute('aria-pressed', String(pressed));
    button.classList.toggle('selected', pressed);
    button.classList.toggle('filter-active', pressed);
  }

  function updateCategoryButtons() {
    for (const button of categoryButtons) {
      setPressed(button, button.dataset.category === activeCategory);
    }
  }

  function updateTagButtons() {
    for (const button of tagButtons) {
      setPressed(button, selectedTags.has(button.dataset.tag ?? ''));
    }
  }

  function updateFavoriteButton() {
    if (!favoritesToggle) return;
    favoritesToggle.classList.toggle(
      'filter-active',
      favoritesToggle.getAttribute('aria-pressed') === 'true',
    );
  }

  function updateSortLabel() {
    const label = document.getElementById('pin-current-sort');
    if (label) label.textContent = SORT_LABELS[currentSort];

    for (const option of sortOptions) {
      const selected = option.dataset.sort === currentSort;
      option.classList.toggle('font-semibold', selected);
      option.classList.toggle('text-white/82', selected);
      option.classList.toggle('text-white/72', !selected);
      option.setAttribute('aria-pressed', String(selected));
    }
  }

  function updateClearButton() {
    for (const button of clearFiltersButtons) {
      button.classList.toggle('hidden', !hasActiveFilters());
    }
  }

  function cardMatchesFilters(card: HTMLElement): boolean {
    const searchTerms = normalize(searchInput?.value)
      .split(/\s+/)
      .filter(Boolean);
    const searchable = normalize(
      card.dataset.search ??
        [card.dataset.name, card.dataset.category, card.dataset.tags].join(' '),
    );
    const matchesSearch =
      searchTerms.length === 0 ||
      searchTerms.every((term) => searchable.includes(term));

    const matchesCategory =
      activeCategory === 'all' || card.dataset.category === activeCategory;

    const pinTags = (card.dataset.tags ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const matchesTags =
      selectedTags.size === 0 || pinTags.some((tag) => selectedTags.has(tag));

    const matchesFavorite =
      favoritesToggle?.getAttribute('aria-pressed') !== 'true' ||
      card.dataset.favorite === 'true';

    return matchesSearch && matchesCategory && matchesTags && matchesFavorite;
  }

  function sortCards() {
    if (!grid) return;
    const cards = getPinCards();
    cards.sort((a, b) => {
      switch (currentSort) {
        case 'newest': {
          const dateDiff =
            new Date(b.dataset.date ?? 0).getTime() -
            new Date(a.dataset.date ?? 0).getTime();
          return (
            dateDiff ||
            Number(a.dataset.index ?? 0) - Number(b.dataset.index ?? 0)
          );
        }
        case 'oldest': {
          const dateDiff =
            new Date(a.dataset.date ?? 0).getTime() -
            new Date(b.dataset.date ?? 0).getTime();
          return (
            dateDiff ||
            Number(a.dataset.index ?? 0) - Number(b.dataset.index ?? 0)
          );
        }
        case 'name':
          return (a.dataset.name ?? '').localeCompare(b.dataset.name ?? '');
        case 'category': {
          const categoryDiff = (a.dataset.category ?? '').localeCompare(
            b.dataset.category ?? '',
          );
          return (
            categoryDiff ||
            (a.dataset.name ?? '').localeCompare(b.dataset.name ?? '')
          );
        }
        default:
          return 0;
      }
    });

    for (const card of cards) {
      grid.appendChild(card);
    }
  }

  function setMobileCardVisibility(pinId: string, isVisible: boolean) {
    const mobileCard = document.getElementById(`pin-mobile-${pinId}`);
    mobileCard?.classList.toggle('hidden', !isVisible);
  }

  function applyFilters() {
    const cards = getPinCards();
    sortCards();

    let visibleCount = 0;
    for (const card of getPinCards()) {
      const isVisible = cardMatchesFilters(card);
      card.style.display = isVisible ? '' : 'none';
      card.dataset.visible = String(isVisible);
      setMobileCardVisibility(card.dataset.pinId ?? '', isVisible);
      if (isVisible) visibleCount++;
    }

    const countEl = document.getElementById('visible-count');
    if (countEl) countEl.textContent = visibleCount.toString();

    const statusEl = document.getElementById('pin-filter-status');
    if (statusEl) {
      statusEl.setAttribute(
        'aria-label',
        `Showing ${visibleCount} of ${cards.length} pins`,
      );
    }

    const noResults = document.getElementById('pin-no-results');
    const showNoResults = visibleCount === 0 && cards.length > 0;
    noResults?.classList.toggle('hidden', !showNoResults);
    grid?.classList.toggle('hidden', showNoResults);
    updateClearButton();
    onChange?.();
  }

  function getVisibleCount(): number {
    return getVisiblePinIds().length;
  }

  function trackSearchInput() {
    if (!searchInput) return;
    if (searchTrackTimer !== null) window.clearTimeout(searchTrackTimer);
    searchTrackTimer = window.setTimeout(() => {
      searchTrackTimer = null;
      const filterText = normalize(searchInput.value);
      if (!filterText) return;
      trackEvent('pin_search', {
        query_length: filterText.length,
        result_count: getVisibleCount(),
        selected_tag_count: selectedTags.size,
      });
    }, 800);
  }

  function resetFilters() {
    const hadFilterText = normalize(searchInput?.value) !== '';
    const previousCategory = activeCategory;
    const previousSelectedTags = selectedTags.size;
    const previousFavorites =
      favoritesToggle?.getAttribute('aria-pressed') === 'true';

    if (searchInput) searchInput.value = '';
    if (favoritesToggle) {
      favoritesToggle.setAttribute('aria-pressed', 'false');
    }
    activeCategory = 'all';
    selectedTags.clear();
    updateCategoryButtons();
    updateTagButtons();
    updateFavoriteButton();
    applyFilters();
    trackEvent('pin_filter_clear', {
      category: previousCategory,
      had_favorites: previousFavorites,
      had_filter_text: hadFilterText,
      selected_tag_count: previousSelectedTags,
    });
  }

  function getVisiblePinIds(): string[] {
    return (
      [...document.querySelectorAll('#pin-grid .pin-card')] as HTMLElement[]
    )
      .filter(
        (el) => el.style.display !== 'none' && el.dataset.visible !== 'false',
      )
      .map((el) => el.dataset.pinId ?? '')
      .filter(Boolean);
  }

  // ---- Wire up the listeners ----

  favoritesToggle?.addEventListener(
    'click',
    () => {
      const isPressed = favoritesToggle.getAttribute('aria-pressed') === 'true';
      favoritesToggle.setAttribute('aria-pressed', String(!isPressed));
      updateFavoriteButton();
      applyFilters();
      trackEvent('pin_favorites_toggle', {
        enabled: !isPressed,
        result_count: getVisibleCount(),
      });
    },
    { signal },
  );

  searchInput?.addEventListener(
    'input',
    () => {
      applyFilters();
      trackSearchInput();
    },
    { signal },
  );
  searchInput?.addEventListener(
    'keydown',
    (e) => {
      if ((e as KeyboardEvent).key === 'Escape' && searchInput.value) {
        searchInput.value = '';
        applyFilters();
        trackEvent('pin_search_clear', {
          result_count: getVisibleCount(),
          selected_tag_count: selectedTags.size,
        });
      }
    },
    { signal },
  );

  for (const button of categoryButtons) {
    button.addEventListener(
      'click',
      () => {
        activeCategory = button.dataset.category ?? 'all';
        updateCategoryButtons();
        applyFilters();
        trackEvent('pin_category_filter', {
          category: activeCategory,
          result_count: getVisibleCount(),
        });
      },
      { signal },
    );
  }

  for (const button of tagButtons) {
    button.addEventListener(
      'click',
      () => {
        const tag = button.dataset.tag;
        if (!tag) return;
        const action = selectedTags.has(tag) ? 'remove' : 'add';
        if (selectedTags.has(tag)) {
          selectedTags.delete(tag);
        } else {
          selectedTags.add(tag);
        }
        updateTagButtons();
        applyFilters();
        trackEvent('pin_tag_filter', {
          action,
          result_count: getVisibleCount(),
          selected_tag_count: selectedTags.size,
          tag,
        });
      },
      { signal },
    );
  }

  for (const button of clearFiltersButtons) {
    button.addEventListener('click', resetFilters, { signal });
  }

  for (const option of sortOptions) {
    option.addEventListener(
      'click',
      () => {
        const sortBy = option.dataset.sort as SortKey | undefined;
        if (!sortBy) return;
        currentSort = sortBy;
        updateSortLabel();
        applyFilters();
        trackEvent('pin_sort_change', {
          result_count: getVisibleCount(),
          sort: currentSort,
        });
        document.getElementById('pin-sort-menu')?.classList.remove('open');
        document
          .getElementById('pin-sort-btn')
          ?.setAttribute('aria-expanded', 'false');
      },
      { signal },
    );
  }

  // Initial paint
  updateCategoryButtons();
  updateTagButtons();
  updateFavoriteButton();
  updateSortLabel();
  applyFilters();

  signal.addEventListener(
    'abort',
    () => {
      if (searchTrackTimer !== null) window.clearTimeout(searchTrackTimer);
      searchTrackTimer = null;
    },
    { once: true },
  );

  return {
    getCurrentSort: () => currentSort,
    getActiveCategory: () => activeCategory,
    getSelectedTags: () => selectedTags,
    applyFilters,
    resetFilters,
    getVisiblePinIds,
  };
}
