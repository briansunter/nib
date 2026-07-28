import type { NavigationHistoryState } from './types'

export const HISTORY_INDEX = '__nibNavigationIndex'
export const HISTORY_SCROLL_X = '__nibScrollX'
export const HISTORY_SCROLL_Y = '__nibScrollY'

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
