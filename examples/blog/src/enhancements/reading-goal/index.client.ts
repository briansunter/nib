import type { ClientEnhancement } from '@briansunter/nib'

export default ((root, signal) => {
  const count = root.querySelector<HTMLElement>('[data-saved-count]')
  const button = root.querySelector<HTMLButtonElement>('button')
  if (!count || !button) return

  let saved = Number(root.dataset.saved ?? count.textContent ?? '0')
  button.addEventListener('click', () => {
    saved += 1
    count.textContent = String(saved)
  }, { signal })
}) satisfies ClientEnhancement
