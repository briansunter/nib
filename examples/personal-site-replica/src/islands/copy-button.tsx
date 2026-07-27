import { defineIsland } from '@briansunter/nib'
import { useState } from 'react'

function CopyButtonComponent({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button className="copy-button" type="button" onClick={copy} aria-label={copied ? 'Copied' : label}>
      <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
      <span>{copied ? 'Copied' : label}</span>
    </button>
  )
}

export default defineIsland('copy-button', CopyButtonComponent)
