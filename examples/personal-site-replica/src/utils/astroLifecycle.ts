export type AstroLifecycleEvent =
  | 'astro:after-swap'
  | 'astro:page-load'
  | 'DOMContentLoaded';

export interface AstroLifecycleOptions {
  destroy?: () => void;
  mount: () => void;
  mountEvent?: AstroLifecycleEvent;
  runImmediately?: boolean;
}

export function registerAstroLifecycle({
  destroy,
  mount,
  mountEvent = 'astro:page-load',
  runImmediately = false,
}: AstroLifecycleOptions): () => void {
  document.addEventListener(mountEvent, mount);

  const beforeSwap = () => {
    destroy?.();
  };

  if (destroy) {
    document.addEventListener('astro:before-swap', beforeSwap);
  }

  if (runImmediately) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
      mount();
    }
  }

  return () => {
    document.removeEventListener(mountEvent, mount);
    document.removeEventListener('DOMContentLoaded', mount);
    if (destroy) {
      document.removeEventListener('astro:before-swap', beforeSwap);
    }
  };
}

export function registerAstroPageBehavior(
  mount: () => void,
  destroy?: () => void,
): () => void {
  let mountedForCurrentPage = false;

  const mountCurrentPage = () => {
    if (mountedForCurrentPage) return;
    mountedForCurrentPage = true;
    mount();
  };

  const beforeSwap = () => {
    destroy?.();
    mountedForCurrentPage = false;
  };

  document.addEventListener('astro:page-load', mountCurrentPage);
  document.addEventListener('astro:before-swap', beforeSwap);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountCurrentPage, {
      once: true,
    });
  } else {
    mountCurrentPage();
  }

  return () => {
    document.removeEventListener('astro:page-load', mountCurrentPage);
    document.removeEventListener('astro:before-swap', beforeSwap);
    document.removeEventListener('DOMContentLoaded', mountCurrentPage);
  };
}
