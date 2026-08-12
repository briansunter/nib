import { enhance } from '@briansunter/nib'

export function ThemeToggle() {
  return (
    <button
      {...enhance('theme-toggle')}
      aria-label="Switch color theme"
      aria-pressed="false"
      className="theme-toggle"
      data-theme-toggle=""
      type="button"
    >
      <span aria-hidden="true" data-theme-icon="">◐</span>
      <span>Theme</span>
    </button>
  )
}
