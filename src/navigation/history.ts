import type { NavigationHistoryState } from './types'

export const HISTORY_INDEX = '__nibNavigationIndex'
export const HISTORY_SCROLL_X = '__nibScrollX'
export const HISTORY_SCROLL_Y = '__nibScrollY'
export const HISTORY_WRITE_EVENT = 'nib:navigation-history-write'

export interface NavigationHistoryWriteOptions {
  readonly mode?: 'push' | 'replace'
  readonly state?: Record<string, unknown>
}

export interface NavigationHistoryWriteDetail {
  handled: boolean
  readonly mode: 'push' | 'replace'
  readonly state: Record<string, unknown>
  readonly url: URL
}

export function navigationState(): NavigationHistoryState {
  const state = history.state
  return state && typeof state === 'object'
    ? state as NavigationHistoryState
    : {}
}

export function stateNumber(
  state: NavigationHistoryState | null,
  key: keyof NavigationHistoryState,
  fallback: number,
): number {
  const value = state?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function replaceHistoryScroll(
  index: number,
  x = window.scrollX,
  y = window.scrollY,
) {
  const state = navigationState()
  history.replaceState({
    ...state,
    [HISTORY_INDEX]: index,
    [HISTORY_SCROLL_X]: x,
    [HISTORY_SCROLL_Y]: y,
  }, '')
}

/**
 * Writes same-document query/hash state without desynchronizing Nib navigation.
 * Feature controllers should use this instead of calling history.pushState or
 * history.replaceState directly while client navigation is mounted.
 */
export function writeNavigationHistory(
  destination: string | URL,
  options: NavigationHistoryWriteOptions = {},
): void {
  const url = new URL(destination, location.href)
  const current = new URL(location.href)
  if (url.origin !== current.origin || url.pathname !== current.pathname) {
    throw new Error('writeNavigationHistory only accepts same-document URLs')
  }
  const mode = options.mode ?? 'replace'
  const state = options.state ?? navigationState()
  const detail: NavigationHistoryWriteDetail = {
    handled: false,
    mode,
    state,
    url,
  }
  window.dispatchEvent(new CustomEvent(HISTORY_WRITE_EVENT, { detail }))
  if (detail.handled) return

  const currentIndex = stateNumber(navigationState(), HISTORY_INDEX, 0)
  const nextIndex = currentIndex
  history[mode === 'push' ? 'pushState' : 'replaceState']({
    ...state,
    [HISTORY_INDEX]: nextIndex,
    [HISTORY_SCROLL_X]: window.scrollX,
    [HISTORY_SCROLL_Y]: window.scrollY,
  }, '', url)
}
