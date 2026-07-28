/**
 * Shared theme constants
 *
 * SOURCE OF TRUTH for theme colors used across:
 * - src/components/BaseHead.astro (FOUC prevention inline styles/scripts)
 * - src/styles/tokens.css (CSS custom properties)
 *
 * Keeping these values in sync prevents flash of unstyled content (FOUC)
 * when switching between light and dark modes.
 */

import { ANALYTICS_CONFIG } from './analytics-config';

export const THEME = {
  light: {
    surface: '#f5f4f1', // Main background - warm off-white
    surfaceElevated: '#ffffff', // Cards, modals
    surfaceSubtle: '#f5f5f4', // Subtle backgrounds
    ink: '#111827', // Primary text - near black (Tailwind gray-900)
    inkSecondary: '#374151', // Secondary text (Tailwind gray-700)
    inkMuted: '#586273', // Muted/disabled text - 5.6:1 on warm off-white surface, 5.1:1 on surface-hover (passes WCAG AA)
    accent: '#2c4994', // Warmed navy (oklch ~0.42 0.14 245)
    accentHover: '#233a78', // Accent hover state
    accentSubtle: '#d8def0', // Subtle accent backgrounds
    border: '#e5e5e5', // Default borders
    borderSubtle: '#f0f0f0', // Subtle borders
  },
  dark: {
    surface: '#1b1917', // Main background - warm charcoal
    surfaceElevated: '#24211e', // Cards, modals
    surfaceSubtle: '#2e2925', // Subtle backgrounds
    ink: '#ece7e1', // Primary text - warm muted white
    inkSecondary: '#c8c0b7', // Secondary text
    inkMuted: '#aaa197', // Muted/disabled text
    accent: '#7d97df', // Warmed navy, lifted for dark elevated surfaces
    accentHover: '#8aa0e3', // Accent hover state
    accentSubtle: '#1e2a4a', // Subtle accent backgrounds
    border: '#463f38', // Default borders
    borderSubtle: '#332e29', // Subtle borders
  },
} as const;

// sessionStorage key for theme preference override
export const THEME_STORAGE_KEY = 'theme';

// Type for theme mode
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Generates inline CSS for FOUC prevention
 * Used in BaseHead.astro to prevent flash of unstyled content
 */
export function generateFoucPreventionCSS(): string {
  return `
    html {
      background-color: ${THEME.light.surface};
      color: ${THEME.light.ink};
    }
    html.dark {
      background-color: ${THEME.dark.surface};
      color: ${THEME.dark.ink};
    }
    body {
      background-color: ${THEME.light.surface};
      color: ${THEME.light.ink};
      transition: none !important;
    }
    html.dark body {
      background-color: ${THEME.dark.surface};
      color: ${THEME.dark.ink};
    }
  `;
}

// Override TTL in milliseconds (60 minutes)
export const THEME_OVERRIDE_TTL_MS = 60 * 60 * 1000;

/**
 * Generates inline JavaScript for FOUC prevention
 * Used in BaseHead.astro to apply theme before any content renders
 * Uses sessionStorage with time-based expiry (60 min)
 */
export function generateThemeScript(): string {
  const analyticsHostnames = JSON.stringify(
    ANALYTICS_CONFIG.productionHostnames,
  );

  return `
(() => {
  const STORAGE_KEY = "${THEME_STORAGE_KEY}";
  const THEME_EVENT = "theme-changed";
  const OVERRIDE_TTL_MS = ${THEME_OVERRIDE_TTL_MS};
  const INIT_KEY = "__bsThemeControllerInitialized";
  const REFRESH_KEY = "__bsThemeRefresh";
  const ANALYTICS_HOSTNAMES = ${analyticsHostnames};
  const LIGHT_BG = "${THEME.light.surface}", LIGHT_TEXT = "${THEME.light.ink}";
  const DARK_BG = "${THEME.dark.surface}", DARK_TEXT = "${THEME.dark.ink}";
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  if (window[INIT_KEY]) {
    const refresh = window[REFRESH_KEY];
    if (typeof refresh === "function") {
      refresh();
    }
    return;
  }

  window[INIT_KEY] = true;

  function getOverride() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const { theme, timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp > OVERRIDE_TTL_MS) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return theme;
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  function setOverride(theme) {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme, timestamp: Date.now() })
    );
  }

  function getEffectiveTheme() {
    const override = getOverride();
    if (override === "light" || override === "dark") {
      return override;
    }
    return mediaQuery.matches ? "dark" : "light";
  }

  function applyTheme(theme = getEffectiveTheme(), targetDocument = document) {
    const root = targetDocument.documentElement;
    const body = targetDocument.body;
    const themeColor = theme === "dark" ? DARK_BG : LIGHT_BG;

    root.style.colorScheme = theme;
    targetDocument.querySelectorAll("[data-site-theme-color]").forEach((meta) => {
      meta.setAttribute("content", themeColor);
    });

    if (theme === "dark") {
      root.classList.add("dark");
      root.style.backgroundColor = DARK_BG;
      root.style.color = DARK_TEXT;
      if (body) {
        body.style.backgroundColor = DARK_BG;
        body.style.color = DARK_TEXT;
      }
    } else {
      root.classList.remove("dark");
      root.style.backgroundColor = LIGHT_BG;
      root.style.color = LIGHT_TEXT;
      if (body) {
        body.style.backgroundColor = LIGHT_BG;
        body.style.color = LIGHT_TEXT;
      }
    }
  }

  function updateToggleIcons() {
    document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
      const lightIcon = toggle.querySelector('[data-theme-icon="light"]');
      const darkIcon = toggle.querySelector('[data-theme-icon="dark"]');
      const theme = getEffectiveTheme();

      lightIcon?.classList.add("hidden");
      darkIcon?.classList.add("hidden");

      if (theme === "dark") {
        darkIcon?.classList.remove("hidden");
      } else {
        lightIcon?.classList.remove("hidden");
      }
    });
  }

  function refreshThemeUI() {
    applyTheme();
    updateToggleIcons();
  }

  function trackTheme(theme) {
    if (!ANALYTICS_HOSTNAMES.includes(window.location.hostname)) {
      return;
    }

    const tracker = window.umami;
    if (tracker && typeof tracker.track === "function") {
      tracker.track("theme", { mode: theme });
    }
  }

  function handleThemeToggleClick(event) {
    if (!(event.target instanceof Element)) return;

    const toggle = event.target.closest("[data-theme-toggle]");
    if (!toggle) return;

    event.preventDefault();

    const nextTheme = getEffectiveTheme() === "dark" ? "light" : "dark";

    // Mutations must run inside the callback or the old snapshot captures the new theme.
    const commit = () => {
      setOverride(nextTheme);
      applyTheme(nextTheme);
      updateToggleIcons();
      trackTheme(nextTheme);
      window.dispatchEvent(
        new CustomEvent(THEME_EVENT, { detail: { theme: nextTheme } })
      );
    };

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (typeof document.startViewTransition === "function" && !reducedMotion) {
      document.startViewTransition(commit);
    } else {
      commit();
    }
  }

  window[REFRESH_KEY] = refreshThemeUI;

  refreshThemeUI();
  document.addEventListener("click", handleThemeToggleClick);
  document.addEventListener("DOMContentLoaded", updateToggleIcons);
  document.addEventListener("nib:navigation-before-swap", (event) => {
    applyTheme(getEffectiveTheme(), event.detail.newDocument);
  });
  document.addEventListener("nib:navigation-after-swap", refreshThemeUI);
  mediaQuery.addEventListener("change", () => {
    if (!getOverride()) refreshThemeUI();
  });
  window.addEventListener(THEME_EVENT, refreshThemeUI);
})();
  `.trim();
}
