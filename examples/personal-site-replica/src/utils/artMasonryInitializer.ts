import { createMasonryController } from './masonryPacker';

const controller = createMasonryController({
  containerSelector: '.art-gallery .art-items',
  itemSelector: '.art-item',
  itemIndexAttr: 'data-art-index',
  itemHeightRatioAttr: 'data-art-height-ratio',
  columnClass: 'art-column',
  columnIndexAttr: 'data-art-column',
  readyAttr: 'data-art-masonry-ready',
  cssVarColumns: '--art-masonry-columns',
  breakpoints: [
    { minWidth: 1536, columns: 5 },
    { minWidth: 1280, columns: 4 },
    { minWidth: 1024, columns: 3 },
    { minWidth: 640, columns: 2 },
    { minWidth: 0, columns: 1 },
  ],
  defaultColumns: 1,
  viewModeAttr: 'data-view',
  viewModeContainerSelector: '.art-gallery',
  flattenWhenView: 'list',
});

export function initArtMasonry(): void {
  controller.init();
}

export function destroyArtMasonry(): void {
  controller.destroy();
}
