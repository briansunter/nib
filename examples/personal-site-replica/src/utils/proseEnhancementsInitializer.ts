import {
  destroyAutoplayVideos,
  initAutoplayVideos,
} from './autoplayVideoInitializer';
import { initProseLightbox } from './proseLightboxInitializer';

export function initProseEnhancements(): void {
  initAutoplayVideos();

  if (document.querySelector('.prose-editorial img')) {
    initProseLightbox();
  }
}

export function destroyProseEnhancements(): void {
  destroyAutoplayVideos();
}
