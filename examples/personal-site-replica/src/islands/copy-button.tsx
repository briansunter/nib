import { defineIsland } from '@briansunter/nib'
import { useEffect, useRef, useState } from 'react'

function CopyButtonComponent({
  value,
  label,
  inline = false,
}: {
  value: string
  label: string
  inline?: boolean
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  function resetLater() {
    window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => setState('idle'), 2000)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
      resetLater()
    } catch {
      setState('failed')
      resetLater()
    }
  }

  if (inline) {
    const stateLabel = state === 'copied' ? 'Copied!' : state === 'failed' ? 'Copy failed' : label
    const ariaLabel = state === 'copied'
      ? 'Copied to clipboard'
      : state === 'failed'
        ? 'Copy failed'
        : 'Copy code to clipboard'
    return (
      <button
        type="button"
        className="copy-button inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-sans text-xs font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
        data-copy-button
        data-copy-code={value}
        title="Copy code to clipboard"
        aria-label={ariaLabel}
        aria-live="polite"
        onClick={copy}
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <span className="copy-button-label">{stateLabel}</span>
      </button>
    )
  }

  const copied = state === 'copied'
  return (
    <button className="copy-button" type="button" onClick={copy} aria-label={copied ? 'Copied' : label}>
      <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
      <span>{copied ? 'Copied' : label}</span>
    </button>
  )
}

export default defineIsland('copy-button', CopyButtonComponent)
