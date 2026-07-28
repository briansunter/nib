export type NavigationDirection = 'back' | 'forward'
export type NavigationType = 'push' | 'replace' | 'traverse'

export interface NavigateOptions {
  readonly history?: Extract<NavigationType, 'push' | 'replace'>
  readonly sourceElement?: Element
}

export interface ClientNavigationController {
  mount(): void
  navigate(to: string | URL, options?: NavigateOptions): Promise<void>
  destroy(): void
}

export interface FetchedPage {
  finalUrl: string
  html: string
  mediaType: DOMParserSupportedType
}

export interface NavigationContext {
  direction: NavigationDirection
  from?: URL
  history: NavigationType
  restoreScroll?: { x: number; y: number }
  sourceElement?: Element
}

export interface NavigationHistoryState {
  __nibNavigationIndex?: number
  __nibScrollX?: number
  __nibScrollY?: number
  [key: string]: unknown
}

export interface NavigationLifecycleDetail {
  readonly direction: NavigationDirection
  readonly from: URL
  readonly navigationType: NavigationType
  readonly sourceElement?: Element
  readonly to: URL
}

export interface NavigationBeforeSwapDetail extends NavigationLifecycleDetail {
  readonly newDocument: Document
  readonly signal: AbortSignal
  swap: () => void | Promise<void>
  readonly viewTransition?: ViewTransition
}

declare global {
  interface DocumentEventMap {
    'nib:navigation-before-swap': CustomEvent<NavigationBeforeSwapDetail>
    'nib:navigation-after-swap': CustomEvent<NavigationLifecycleDetail>
    'nib:navigation-load': CustomEvent<NavigationLifecycleDetail>
  }
}
