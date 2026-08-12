import type { ClientEnhancement } from '@briansunter/nib'
import './reveal.css'

export default ((root, signal) => {
  const button = root.querySelector('button')
  const panel = root.querySelector<HTMLElement>('[data-panel]')
  if (!button || !panel) return
  const toggle = () => {
    panel.hidden = !panel.hidden
  }
  button.addEventListener('click', toggle, { signal })
}) satisfies ClientEnhancement
