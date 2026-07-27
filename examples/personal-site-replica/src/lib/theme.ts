/**
 * FOUC-safe theme controller, ported from the reference site's theme script.
 *
 * Applied inline in the document head so the effective theme (session override
 * or system preference) is resolved before first paint. A document-level click
 * listener on `[data-theme-toggle]` flips the override; `[data-theme-icon]`
 * elements show the sun/moon glyph for the current effective theme.
 *
 * Mirrors src/lib/theme.ts + BaseHead.astro in the reference, minus analytics.
 */

export const THEME_STORAGE_KEY = 'theme'
export const THEME_OVERRIDE_TTL_MS = 60 * 60 * 1000

const LIGHT_BG = '#f5f4f1'
const LIGHT_TEXT = '#111827'
const DARK_BG = '#1b1917'
const DARK_TEXT = '#ece7e1'

export function generateThemeScript(): string {
  return `
(() => {
  const STORAGE_KEY = ${JSON.stringify(THEME_STORAGE_KEY)};
  const OVERRIDE_TTL_MS = ${String(THEME_OVERRIDE_TTL_MS)};
  const INIT_KEY = "__bsThemeControllerInitialized";
  const REFRESH_KEY = "__bsThemeRefresh";
  const LIGHT_BG = ${JSON.stringify(LIGHT_BG)}, LIGHT_TEXT = ${JSON.stringify(LIGHT_TEXT)};
  const DARK_BG = ${JSON.stringify(DARK_BG)}, DARK_TEXT = ${JSON.stringify(DARK_TEXT)};
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  if (window[INIT_KEY]) {
    const refresh = window[REFRESH_KEY];
    if (typeof refresh === "function") refresh();
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
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, timestamp: Date.now() }));
  }

  function getEffectiveTheme() {
    const override = getOverride();
    if (override === "light" || override === "dark") return override;
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
      if (body) { body.style.backgroundColor = DARK_BG; body.style.color = DARK_TEXT; }
    } else {
      root.classList.remove("dark");
      root.style.backgroundColor = LIGHT_BG;
      root.style.color = LIGHT_TEXT;
      if (body) { body.style.backgroundColor = LIGHT_BG; body.style.color = LIGHT_TEXT; }
    }
  }

  function updateToggleIcons() {
    const theme = getEffectiveTheme();
    document.querySelectorAll("[data-theme-toggle]").forEach((toggle) => {
      const lightIcon = toggle.querySelector('[data-theme-icon="light"]');
      const darkIcon = toggle.querySelector('[data-theme-icon="dark"]');
      lightIcon && lightIcon.classList.add("hidden");
      darkIcon && darkIcon.classList.add("hidden");
      if (theme === "dark") darkIcon && darkIcon.classList.remove("hidden");
      else lightIcon && lightIcon.classList.remove("hidden");
    });
  }

  function refreshThemeUI() {
    applyTheme();
    updateToggleIcons();
  }

  function handleThemeToggleClick(event) {
    if (!(event.target instanceof Element)) return;
    const toggle = event.target.closest("[data-theme-toggle]");
    if (!toggle) return;
    event.preventDefault();
    const nextTheme = getEffectiveTheme() === "dark" ? "light" : "dark";
    const commit = () => {
      setOverride(nextTheme);
      applyTheme(nextTheme);
      updateToggleIcons();
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  mediaQuery.addEventListener("change", () => {
    if (!getOverride()) refreshThemeUI();
  });
})();
`.trim()
}
