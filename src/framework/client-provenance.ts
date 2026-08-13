/** Stable, machine-readable ownership of browser assets emitted by a site build. */
export interface ClientProvenanceModule {
  readonly id: string
  readonly file: string
  readonly stylesheets: readonly string[]
  readonly preloads: readonly string[]
}

export interface ClientProvenanceRuntime {
  readonly file: string
  readonly preloads: readonly string[]
}

export interface ClientProvenanceRoute {
  readonly path: string
  readonly artifact: string
  readonly enhancements: readonly { readonly id: string; readonly when: 'load' | 'visible' }[]
  readonly islands: readonly { readonly id: string; readonly when: 'load' | 'visible' }[]
  readonly javascript: readonly string[]
  readonly stylesheets: readonly string[]
  readonly preloads: readonly string[]
}

export interface ClientProvenanceReport {
  readonly version: 1
  readonly runtimes: Readonly<{
    readonly client?: ClientProvenanceRuntime
    readonly enhancements?: ClientProvenanceRuntime
    readonly islands?: ClientProvenanceRuntime
  }>
  readonly modules: Readonly<{
    readonly enhancements: Readonly<Record<string, ClientProvenanceModule>>
    readonly islands: Readonly<Record<string, ClientProvenanceModule>>
  }>
  readonly routes: readonly ClientProvenanceRoute[]
}
