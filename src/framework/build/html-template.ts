export interface ManifestEntry {
  css?: string[]
  file: string
  imports?: string[]
  dynamicImports?: string[]
  isEntry?: boolean
  name?: string
}

export type ViteManifest = Record<string, ManifestEntry>

/** @internal Exported for framework contract tests, not from the package API. */
export function manifestModulePreloads(
  manifest: ViteManifest,
  entry: ManifestEntry,
): string[] {
  const visited = new Set<string>()
  const files = new Set<string>()
  const visit = (current: ManifestEntry) => {
    for (const imported of current.imports ?? []) {
      if (visited.has(imported)) continue
      visited.add(imported)
      const dependency = manifest[imported]
      if (dependency === undefined) {
        throw new Error(`Nib client manifest references missing module ${imported}`)
      }
      if (dependency.file !== entry.file) files.add(dependency.file)
      visit(dependency)
    }
  }
  visit(entry)
  return [...files]
}

/** @internal Exported for framework contract tests, not from the package API. */
export function manifestStylesheets(
  manifest: ViteManifest,
  entry: ManifestEntry,
): string[] {
  const visited = new Set<ManifestEntry>()
  const files = new Set<string>()
  const visit = (current: ManifestEntry) => {
    if (visited.has(current)) return
    visited.add(current)
    for (const file of current.css ?? []) files.add(file)
    if (current.file.endsWith('.css')) files.add(current.file)
    for (const imported of current.imports ?? []) {
      const dependency = manifest[imported]
      if (dependency === undefined) {
        throw new Error(`Nib client manifest references missing module ${imported}`)
      }
      visit(dependency)
    }
  }
  visit(entry)
  return [...files]
}

interface HtmlTemplateEntry {
  readonly source: string
  readonly preloads: readonly string[]
}

export interface HtmlTemplateEntries {
  readonly island?: HtmlTemplateEntry
  readonly enhancement?: HtmlTemplateEntry
  readonly client?: HtmlTemplateEntry
  readonly stylesheets: readonly string[]
}

export const ROUTE_CLIENT_ASSET_MARKER = '<!--nib-route-client-assets-->'

function modulePreloadLinks(
  owner: 'islands' | 'enhancements' | 'client',
  preloads: readonly string[],
): string {
  return preloads
    .map((href) => (
      `<link data-nib-runtime-preload="${owner}" rel="modulepreload" href="${href}" />`
    ))
    .join('\n    ')
}

export function htmlTemplate(entries: HtmlTemplateEntries): string {
  const styles = entries.stylesheets
    .map((href) => `<link rel="stylesheet" href="${href}" />`)
    .join('\n    ')
  const clientPreloadSet = new Set(entries.client?.preloads ?? [])
  const islandPreloads = entries.island === undefined
    ? ''
    : modulePreloadLinks(
        'islands',
        [...new Set(entries.island.preloads)].filter((href) => (
          !clientPreloadSet.has(href)
        )),
      )
  const enhancementPreloads = entries.enhancement === undefined
    ? ''
    : modulePreloadLinks(
        'enhancements',
        [...new Set(entries.enhancement.preloads)].filter((href) => (
          !clientPreloadSet.has(href)
        )),
      )
  const clientPreloads = entries.client === undefined
    ? ''
    : modulePreloadLinks('client', [...clientPreloadSet])
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!--head-outlet-->
    ${styles}
    ${clientPreloads}
    ${entries.client === undefined
      ? ''
      : `<script data-nib-client type="module" src="${entries.client.source}"></script>`}
    ${ROUTE_CLIENT_ASSET_MARKER}
    ${islandPreloads}
    ${entries.island === undefined
      ? ''
      : `<!--nib-islands-entry--><script data-nib-islands type="module" src="${entries.island.source}"></script>`}
    ${enhancementPreloads}
    ${entries.enhancement === undefined
      ? ''
      : `<!--nib-enhancements-entry--><script data-nib-enhancements type="module" src="${entries.enhancement.source}"></script>`}
  </head>
  <body>
    <div id="root"><!--ssr-outlet--></div>
  </body>
</html>`
}
