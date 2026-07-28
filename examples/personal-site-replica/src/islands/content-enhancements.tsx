import { useEffect } from 'react'
import { defineIsland } from '@briansunter/nib'
import {
  destroyProseEnhancements,
  initProseEnhancements,
} from '../utils/proseEnhancementsInitializer'

function textFrom(element: Element): string {
  return element.textContent?.trim() ?? ''
}

function ContentEnhancements() {
  useEffect(() => {
    initProseEnhancements()

    const copyButtons = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.code-block-wrapper [data-copy-button]',
      ),
    ]
    const copyHandlers = copyButtons.map((button) => {
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
        if (label) {
          label.textContent = state === 'copied' ? 'Copied!' : 'Copy failed'
        }
        button.dataset.copyState = state
        button.setAttribute(
          'aria-label',
          state === 'copied' ? 'Copied to clipboard' : 'Copy failed',
        )
        resetTimer = window.setTimeout(reset, 2000)
      }
      const handler = async () => {
        const value = button.dataset.code ?? ''
        if (!value) return
        try {
          if (!navigator.clipboard) throw new Error('Clipboard unavailable')
          await navigator.clipboard.writeText(value)
          showState('copied')
        } catch {
          showState('failed')
        }
      }
      button.addEventListener('click', handler)
      return {
        button,
        handler,
        cleanup: () => {
          window.clearTimeout(resetTimer)
          reset()
        },
      }
    })

    const renderMermaid = async () => {
      const diagrams = [...document.querySelectorAll<HTMLElement>('.mermaid:not([data-mermaid-ready])')]
      if (diagrams.length === 0) return
      try {
        const module = await import('mermaid')
        const mermaid = module.default
        mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default' })
        for (const diagram of diagrams) {
          diagram.dataset.mermaidReady = 'true'
          diagram.textContent = diagram.dataset.mermaidSource ?? textFrom(diagram)
        }
        await mermaid.run({ nodes: diagrams })
      } catch {
        // Keep the source visible when a diagram is unsupported or malformed.
      }
    }

    void renderMermaid()
    return () => {
      destroyProseEnhancements()
      for (const { button, handler, cleanup } of copyHandlers) {
        button.removeEventListener('click', handler)
        cleanup()
      }
    }
  }, [])

  return <span className="content-enhancements" hidden aria-hidden="true" />
}

export default defineIsland('content-enhancements', ContentEnhancements)
