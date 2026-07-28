import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'
import '../styles/integrations/prose-lightbox.css'
import {
  destroyProseEnhancements,
  initProseEnhancements,
} from '../utils/proseEnhancementsInitializer'

function textFrom(element: Element): string {
  return element.textContent?.trim() ?? ''
}

export default defineBehaviorClient('content-enhancements', ({ signal }) => {
  initProseEnhancements()

  const copyButtons = [
    ...document.querySelectorAll<HTMLButtonElement>(
      '.code-block-wrapper [data-copy-button]',
    ),
  ]
  const resets = copyButtons.map((button) => {
    let resetTimer: number | undefined
    const label = button.querySelector<HTMLElement>('.copy-button-label')
    const originalLabel = label?.textContent ?? 'Copy'
    const originalAriaLabel =
      button.getAttribute('aria-label') ?? 'Copy code to clipboard'
    const reset = () => {
      if (label) label.textContent = originalLabel
      button.removeAttribute('data-copy-state')
      button.setAttribute('aria-label', originalAriaLabel)
    }
    const showState = (state: 'copied' | 'failed') => {
      window.clearTimeout(resetTimer)
      if (label) label.textContent = state === 'copied' ? 'Copied!' : 'Copy failed'
      button.dataset.copyState = state
      button.setAttribute(
        'aria-label',
        state === 'copied' ? 'Copied to clipboard' : 'Copy failed',
      )
      resetTimer = window.setTimeout(reset, 2000)
    }
    button.addEventListener('click', async () => {
      const value = button.dataset.code ?? ''
      if (!value) return
      try {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable')
        await navigator.clipboard.writeText(value)
        showState('copied')
      } catch {
        showState('failed')
      }
    }, { signal })
    return () => {
      window.clearTimeout(resetTimer)
      reset()
    }
  })

  const diagrams = [
    ...document.querySelectorAll<HTMLElement>('.mermaid:not([data-mermaid-ready])'),
  ]
  if (diagrams.length > 0) {
    void import('mermaid').then(async ({ default: mermaid }) => {
      if (signal.aborted) return
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
      })
      for (const diagram of diagrams) {
        diagram.dataset.mermaidReady = 'true'
        diagram.textContent = diagram.dataset.mermaidSource ?? textFrom(diagram)
      }
      await mermaid.run({ nodes: diagrams })
    }).catch(() => {
      // Keep source visible when a diagram is unsupported or malformed.
    })
  }

  return () => {
    destroyProseEnhancements()
    for (const reset of resets) reset()
  }
})
