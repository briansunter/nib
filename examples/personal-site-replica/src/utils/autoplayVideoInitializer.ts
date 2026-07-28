let activeObserver: IntersectionObserver | undefined;

export function destroyAutoplayVideos(): void {
  activeObserver?.disconnect();
  activeObserver = undefined;

  document
    .querySelectorAll<HTMLVideoElement>('video[data-autoplay-video]')
    .forEach((video) => {
      video.pause();
    });
}

export function initAutoplayVideos(): void {
  destroyAutoplayVideos();

  const videos = Array.from(
    document.querySelectorAll<HTMLVideoElement>('video[data-autoplay-video]'),
  );
  if (videos.length === 0) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const video of videos) video.controls = true;
    return;
  }

  activeObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          void video.play().catch(() => {
            // Preserve access to the media when browser policy blocks autoplay.
            video.controls = true;
          });
        } else {
          video.pause();
        }
      }
    },
    { rootMargin: '200px 0px', threshold: 0.01 },
  );

  for (const video of videos) activeObserver.observe(video);
}
