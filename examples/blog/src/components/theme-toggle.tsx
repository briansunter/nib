import { defineClientBehavior } from '@briansunter/nib'

const ThemeToggleBehavior = defineClientBehavior('theme-toggle')

export function ThemeToggle() {
  return (
    <ThemeToggleBehavior hydrate="load">
      <button
        aria-label="Switch color theme"
        aria-pressed="false"
        className="theme-toggle"
        data-theme-toggle=""
        type="button"
      >
        <span aria-hidden="true" data-theme-icon="">◐</span>
        <span>Theme</span>
      </button>
    </ThemeToggleBehavior>
  )
}
