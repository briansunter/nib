let controller: AbortController | null = null
const resetTimers = new WeakMap<HTMLElement, number>()
const activeButtons = new Set<HTMLElement>()

function getCopyText(button: HTMLElement): string | undefined {
  return (
    button.dataset.copyCode ?? button.dataset.code ?? button.dataset.address
  )
}

function setButtonState(button: HTMLElement, state: 'copied' | 'failed'): void {
  const label = button.querySelector<HTMLElement>('.copy-button-label')
  const originalLabel = button.dataset.copyOriginalLabel ?? label?.textContent
  if (label && originalLabel !== undefined) {
    button.dataset.copyOriginalLabel = originalLabel
    label.textContent =
      state === 'copied'
        ? (button.dataset.copySuccessLabel ?? 'Copied!')
        : (button.dataset.copyFailureLabel ?? 'Copy failed')
  }

  const successClass = button.dataset.copySuccessClass
  if (successClass && state === 'copied') {
    button.classList.add(successClass)
  }

  button.dataset.copyState = state
  button.setAttribute(
    'aria-label',
    state === 'copied' ? 'Copied to clipboard' : 'Copy failed',
  )

  const existingTimer = resetTimers.get(button)
  if (existingTimer !== undefined) {
    window.clearTimeout(existingTimer)
  }

  const timer = window.setTimeout(() => {
    if (label && button.dataset.copyOriginalLabel !== undefined) {
      label.textContent = button.dataset.copyOriginalLabel
    }
    if (successClass) {
      button.classList.remove(successClass)
    }
    button.removeAttribute('data-copy-state')
    if (button.dataset.copyDefaultAriaLabel) {
      button.setAttribute('aria-label', button.dataset.copyDefaultAriaLabel)
    }
    resetTimers.delete(button)
    activeButtons.delete(button)
  }, 2000)
  resetTimers.set(button, timer)
  activeButtons.add(button)
}

function getCopyButton(target: EventTarget | null): HTMLElement | null {
  const element = target instanceof Element ? target : null
  return (
    element?.closest<HTMLElement>(
      'button[data-copy-button], button.copy-button, #copy-btn[data-address]',
    ) ?? null
  )
}

export function initCopyCodeButtons(): void {
  controller?.abort()
  controller = new AbortController()
  const { signal } = controller

  document.addEventListener(
    'click',
    async (event) => {
      const button = getCopyButton(event.target)
      if (!button) return

      const code = getCopyText(button)
      if (!code) return

      button.dataset.copyDefaultAriaLabel ??=
        button.getAttribute('aria-label') ?? 'Copy to clipboard'

      try {
        await navigator.clipboard.writeText(code)
        setButtonState(button, 'copied')
      } catch (err) {
        console.error('Failed to copy code:', err)
        setButtonState(button, 'failed')
      }
    },
    { signal },
  )
}

export function destroyCopyCodeButtons(): void {
  controller?.abort()
  controller = null
  for (const button of activeButtons) {
    const timer = resetTimers.get(button)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      resetTimers.delete(button)
    }
    button.removeAttribute('data-copy-state')
    const successClass = button.dataset.copySuccessClass
    if (successClass) {
      button.classList.remove(successClass)
    }
    const label = button.querySelector<HTMLElement>('.copy-button-label')
    if (label && button.dataset.copyOriginalLabel !== undefined) {
      label.textContent = button.dataset.copyOriginalLabel
    }
  }
  activeButtons.clear()
}
