export interface ManifestEntry {
  css?: string[]
  file: string
  imports?: string[]
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

interface HtmlTemplateEntry {
  readonly source: string
  readonly preloads: readonly string[]
}

export interface HtmlTemplateEntries {
  readonly island: HtmlTemplateEntry
  readonly behavior: HtmlTemplateEntry
  readonly enhancement?: HtmlTemplateEntry
  readonly stylesheets: readonly string[]
}

function modulePreloadLinks(
  owner: 'islands' | 'behaviors' | 'enhancements',
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
  const islandPreloads = modulePreloadLinks('islands', entries.island.preloads)
  const behaviorPreloads = modulePreloadLinks('behaviors', entries.behavior.preloads)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!--head-outlet-->
    ${styles}
    ${islandPreloads}
    <!--nib-islands-entry--><script data-nib-islands type="module" src="${entries.island.source}"></script>
    ${behaviorPreloads}
    <!--nib-behaviors-entry--><script data-nib-behaviors type="module" src="${entries.behavior.source}"></script>
    ${entries.enhancement === undefined
      ? ''
      : `${modulePreloadLinks('enhancements', entries.enhancement.preloads)}
    <script data-nib-enhancements type="module" src="${entries.enhancement.source}"></script>`}
  </head>
  <body>
    <div id="root"><!--ssr-outlet--></div>
  </body>
</html>`
}
