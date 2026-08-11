export function scrollToHash(url: URL): boolean {
  if (!url.hash) return false
  let id: string
  try {
    id = decodeURIComponent(url.hash.slice(1))
  } catch {
    id = url.hash.slice(1)
  }
  const target = document.getElementById(id)
    ?? document.querySelector<HTMLElement>(`[name="${CSS.escape(id)}"]`)
  if (!target) return false
  target.scrollIntoView()
  if (
    target.matches(
      'a[href], button, input, select, textarea, summary, [tabindex]',
    )
  ) {
    target.focus({ preventScroll: true })
  }
  return true
}

/** Focuses the newly rendered route without changing its scroll position. */
export function focusRouteContent(): boolean {
  const active = document.activeElement
  if (
    active instanceof HTMLElement
    && active !== document.body
    && active !== document.documentElement
  ) {
    return false
  }
  const target = document.querySelector<HTMLElement>('main, #main-content, h1')
  if (!target) return false
  if (!target.matches('a[href], button, input, select, textarea, summary, [tabindex]')) {
    target.setAttribute('tabindex', '-1')
  }
  target.focus({ preventScroll: true })
  return document.activeElement === target
}

export function announceRoute(timers: Set<number>): void {
  document.querySelector('.nib-route-announcer')?.remove()
  const announcer = document.createElement('div')
  announcer.className = 'nib-route-announcer'
  announcer.style.cssText = [
    'position:absolute',
    'width:1px',
    'height:1px',
    'padding:0',
    'margin:-1px',
    'overflow:hidden',
    'clip:rect(0, 0, 0, 0)',
    'white-space:nowrap',
    'border:0',
  ].join(';')
  announcer.setAttribute('aria-live', 'assertive')
  announcer.setAttribute('aria-atomic', 'true')
  document.body.append(announcer)
  const timer = window.setTimeout(() => {
    timers.delete(timer)
    announcer.textContent = document.title
      || document.querySelector('h1')?.textContent
      || location.pathname
  }, 60)
  timers.add(timer)
}
