import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'

export default defineBehaviorClient<{ label: string }>('reveal', ({ root, props, signal }) => {
  const button = root.querySelector('button')
  const panel = root.querySelector<HTMLElement>('[data-panel]')
  if (!button || !panel) return
  const toggle = () => {
    panel.hidden = !panel.hidden
  }
  button.addEventListener('click', toggle, { signal })
  root.dataset.label = typeof props.label === 'string' ? props.label : ''
})
