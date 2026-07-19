import { defineIsland } from '@briansunter/nib'
import { useEffect, useState } from 'react'

function ThemeToggleComponent() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem('nib-replica-theme')
    const next = stored === 'dark' || (stored === null && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    window.localStorage.setItem('nib-replica-theme', next ? 'dark' : 'light')
  }

  return (
    <button className="theme-toggle" type="button" onClick={toggle} aria-label="Toggle dark mode">
      <span aria-hidden="true">{dark ? '☼' : '◐'}</span>
      <span>{dark ? 'Light' : 'Dark'} mode</span>
    </button>
  )
}

export default defineIsland('theme-toggle', ThemeToggleComponent)
