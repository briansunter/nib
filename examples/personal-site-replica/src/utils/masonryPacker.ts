export interface MasonryBreakpoint {
  minWidth: number;
  columns: number;
}

export interface MasonryConfig {
  /** Selector for the items container, e.g. `.grid-view .photo-items`. */
  containerSelector: string;
  /** Selector for each item inside the container, e.g. `.photo-item`. */
  itemSelector: string;
  /** Data attribute on each item used to sort by source order, e.g. `data-photo-index`. */
  itemIndexAttr: string;
  /** Data attribute on each item that holds height/width ratio (height ÷ width). */
  itemHeightRatioAttr: string;
  /** Class applied to generated column wrappers, e.g. `photo-column`. */
  columnClass: string;
  /** Data attribute set on each generated column with its 1-based index. */
  columnIndexAttr: string;
  /** Data attribute set on the container once a layout pass completes. */
  readyAttr: string;
  /** CSS variable set on the container with the current column count. */
  cssVarColumns: string;
  /** Breakpoints sorted descending by `minWidth`. */
  breakpoints: MasonryBreakpoint[];
  /** Fallback column count when no breakpoint matches. */
  defaultColumns: number;
  /** Window event name that should trigger a repack. Defaults to `photo-gallery-filtered`. */
  filteredEventName?: string;
  /** Optional list-view configuration. When set, items are flattened (no columns) when the wrapper's view matches. */
  viewModeAttr?: string;
  viewModeContainerSelector?: string;
  flattenWhenView?: string;
}

export interface MasonryController {
  init(): void;
  destroy(): void;
}

const DEFAULT_FILTERED_EVENT = 'photo-gallery-filtered';

function indexFor(item: HTMLElement, attr: string): number {
  const raw = item.getAttribute(attr);
  const value = raw == null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function heightRatioFor(item: HTMLElement, attr: string): number {
  const raw = item.getAttribute(attr);
  const value = raw == null ? Number.NaN : Number(raw);
  if (Number.isFinite(value) && value > 0) return value;

  const image = item.querySelector<HTMLImageElement>('img');
  if (image?.naturalWidth && image.naturalHeight) {
    return image.naturalHeight / image.naturalWidth;
  }

  return 1;
}

function shortestColumnIndex(heights: number[]): number {
  return heights.reduce(
    (shortest, height, index) =>
      height < heights[shortest] ? index : shortest,
    0,
  );
}

export function createMasonryController(
  config: MasonryConfig,
): MasonryController {
  const filteredEventName = config.filteredEventName ?? DEFAULT_FILTERED_EVENT;

  let controller: AbortController | null = null;
  let observer: MutationObserver | null = null;
  let resizeFrame = 0;

  function columnCountForViewport(width: number): number {
    return (
      config.breakpoints.find((breakpoint) => width >= breakpoint.minWidth)
        ?.columns ?? config.defaultColumns
    );
  }

  function collectItems(container: HTMLElement): HTMLElement[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>(config.itemSelector),
    ).sort(
      (a, b) =>
        indexFor(a, config.itemIndexAttr) - indexFor(b, config.itemIndexAttr),
    );
  }

  function createColumn(index: number): HTMLDivElement {
    const column = document.createElement('div');
    column.className = config.columnClass;
    column.setAttribute(config.columnIndexAttr, String(index + 1));
    return column;
  }

  function flattenItems(container: HTMLElement): void {
    const items = collectItems(container);
    container.replaceChildren(...items);
    container.setAttribute(config.readyAttr, 'true');
    container.style.removeProperty(config.cssVarColumns);
  }

  function packItems(container: HTMLElement): void {
    const items = collectItems(container);
    if (items.length === 0) {
      container.setAttribute(config.readyAttr, 'true');
      return;
    }

    const visibleItems = items.filter((item) => !item.hidden);
    const baseColumnCount = columnCountForViewport(window.innerWidth);
    const columnCount = Math.max(
      1,
      Math.min(baseColumnCount, visibleItems.length || baseColumnCount),
    );
    const columns = Array.from({ length: columnCount }, (_, index) =>
      createColumn(index),
    );
    const columnHeights = Array.from({ length: columnCount }, () => 0);

    container.replaceChildren(...columns);

    for (const item of items) {
      if (item.hidden) {
        columns[0]?.append(item);
        continue;
      }

      const columnIndex = shortestColumnIndex(columnHeights);
      columns[columnIndex]?.append(item);
      columnHeights[columnIndex] += heightRatioFor(
        item,
        config.itemHeightRatioAttr,
      );
    }

    container.setAttribute(config.readyAttr, 'true');
    container.style.setProperty(config.cssVarColumns, String(columnCount));
  }

  function shouldFlatten(container: HTMLElement): boolean {
    if (
      !config.viewModeAttr ||
      !config.viewModeContainerSelector ||
      !config.flattenWhenView
    ) {
      return false;
    }

    const wrapper = container.closest<HTMLElement>(
      config.viewModeContainerSelector,
    );
    return (
      wrapper?.getAttribute(config.viewModeAttr) === config.flattenWhenView
    );
  }

  function layoutContainer(container: HTMLElement): void {
    if (shouldFlatten(container)) {
      flattenItems(container);
      return;
    }
    packItems(container);
  }

  function layoutAll(): void {
    document
      .querySelectorAll<HTMLElement>(config.containerSelector)
      .forEach(layoutContainer);
  }

  function schedulePack(): void {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      layoutAll();
    });
  }

  function init(): void {
    destroy();

    controller = new AbortController();
    const { signal } = controller;

    layoutAll();

    window.addEventListener('resize', schedulePack, { signal });
    window.addEventListener(filteredEventName, layoutAll, { signal });

    if (config.viewModeAttr && config.viewModeContainerSelector) {
      observer = new MutationObserver((records) => {
        if (
          records.some(
            (record) =>
              record.type === 'attributes' &&
              record.attributeName === config.viewModeAttr,
          )
        ) {
          schedulePack();
        }
      });

      document
        .querySelectorAll<HTMLElement>(config.viewModeContainerSelector)
        .forEach((wrapper) => {
          observer?.observe(wrapper, {
            attributes: true,
            attributeFilter: [config.viewModeAttr as string],
          });
        });

      signal.addEventListener('abort', () => {
        observer?.disconnect();
        observer = null;
      });
    }
  }

  function destroy(): void {
    controller?.abort();
    controller = null;
    observer?.disconnect();
    observer = null;
    if (resizeFrame) {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = 0;
    }
  }

  return { init, destroy };
}
