export type NavigationLifecycleEvent =
  | 'nib:navigation-after-swap'
  | 'nib:navigation-load'
  | 'DOMContentLoaded';

export interface NavigationLifecycleOptions {
  destroy?: () => void;
  mount: () => void;
  mountEvent?: NavigationLifecycleEvent;
  runImmediately?: boolean;
}

export function registerNavigationLifecycle({
  destroy,
  mount,
  mountEvent = 'nib:navigation-load',
  runImmediately = false,
}: NavigationLifecycleOptions): () => void {
  document.addEventListener(mountEvent, mount);

  const beforeSwap = () => {
    destroy?.();
  };

  if (destroy) {
    document.addEventListener('nib:navigation-before-swap', beforeSwap);
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
      document.removeEventListener('nib:navigation-before-swap', beforeSwap);
    }
  };
}

export function registerNavigationPageBehavior(
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

  document.addEventListener('nib:navigation-load', mountCurrentPage);
  document.addEventListener('nib:navigation-before-swap', beforeSwap);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountCurrentPage, {
      once: true,
    });
  } else {
    mountCurrentPage();
  }

  return () => {
    document.removeEventListener('nib:navigation-load', mountCurrentPage);
    document.removeEventListener('nib:navigation-before-swap', beforeSwap);
    document.removeEventListener('DOMContentLoaded', mountCurrentPage);
  };
}
