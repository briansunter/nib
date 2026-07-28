import { createMasonryController } from './masonryPacker';

const controller = createMasonryController({
  containerSelector: '.grid-view .photo-items',
  itemSelector: '.photo-item',
  itemIndexAttr: 'data-photo-index',
  itemHeightRatioAttr: 'data-photo-height-ratio',
  columnClass: 'photo-column',
  columnIndexAttr: 'data-photo-column',
  readyAttr: 'data-photo-masonry-ready',
  cssVarColumns: '--photo-masonry-columns',
  breakpoints: [
    { minWidth: 1536, columns: 5 },
    { minWidth: 1280, columns: 4 },
    { minWidth: 1024, columns: 3 },
    { minWidth: 640, columns: 2 },
    { minWidth: 0, columns: 2 },
  ],
  defaultColumns: 2,
  viewModeAttr: 'data-view',
  viewModeContainerSelector: '.photo-gallery',
  flattenWhenView: 'list',
});

export function initPhotoMasonry(): void {
  controller.init();
}

export function destroyPhotoMasonry(): void {
  controller.destroy();
}
