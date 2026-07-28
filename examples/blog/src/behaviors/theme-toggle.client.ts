import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'
import './theme-toggle.css'

const storageKey = 'commonplace-theme'

function currentTheme(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function applyTheme(theme: 'light' | 'dark', button: HTMLButtonElement): void {
  document.documentElement.dataset.theme = theme
  button.setAttribute('aria-pressed', String(theme === 'dark'))
  const icon = button.querySelector<HTMLElement>('[data-theme-icon]')
  if (icon) icon.textContent = theme === 'dark' ? '☀' : '◐'
}

export default defineBehaviorClient(({ root, signal }) => {
  const button = root.querySelector<HTMLButtonElement>('[data-theme-toggle]')
  if (!button) return

  const stored = localStorage.getItem(storageKey)
  const initial = stored === 'dark' || stored === 'light'
    ? stored
    : currentTheme()
  applyTheme(initial, button)

  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark'
    localStorage.setItem(storageKey, next)
    applyTheme(next, button)
  }, { signal })
})
