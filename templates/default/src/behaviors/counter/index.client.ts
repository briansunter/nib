import type { ClientBehavior } from '@briansunter/nib'

export default ((root, signal) => {
  const initial = Number(root.dataset.count ?? '0')
  let count = Number.isFinite(initial) ? initial : 0
  root.addEventListener('click', () => {
    count += 1
    root.textContent = `Count: ${count}`
  }, { signal })
}) satisfies ClientBehavior
