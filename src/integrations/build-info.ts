import { definePlugin, type NibPlugin } from '../framework/plugin'

export interface BuildInfoOptions {
  /** Public path of the JSON resource, e.g. '/build-info.json'. */
  readonly path: string
  /** Static values, or a function called at build time to compute them. */
  readonly values:
    | Readonly<Record<string, unknown>>
    | (() => Readonly<Record<string, unknown>>)
}

/** Emits an app-owned JSON resource (e.g. build-info.json) as a route. */
export function buildInfo(options: BuildInfoOptions): NibPlugin {
  if (
    typeof options?.path !== 'string'
    || !options.path.startsWith('/')
    || !options.path.endsWith('.json')
  ) {
    throw new Error('buildInfo path must be a absolute .json route')
  }
  return definePlugin({
    name: '@briansunter/nib-build-info',
    routes() {
      const values = typeof options.values === 'function' ? options.values() : options.values
      return {
        kind: 'resource',
        path: options.path,
        contentType: 'application/json; charset=utf-8',
        body: `${JSON.stringify(values)}\n`,
      }
    },
  })
}
