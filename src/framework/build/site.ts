import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import react from '@vitejs/plugin-react'
import {
  build as viteBuild,
  createServer as createViteServer,
  isRunnableDevEnvironment,
  preview as vitePreview,
  type Plugin,
  type InlineConfig,
  type PreviewServer,
  type ViteDevServer,
} from 'vite'
import { glob } from 'tinyglobby'
import { renderDocument, renderRedirectDocument } from '../document'
import { pageSourceExtensions, pageSourcePatterns } from '../content'
import { nibClientEntry } from '../client-entry-plugin'
import {
  NIB_APP_CLIENT_ENTRY,
  NIB_ENHANCEMENT_ENTRY,
  NIB_ISLAND_ENTRY,
  NIB_SERVER_ENTRY,
  NIB_EMPTY_CLIENT_ENTRY,
  nibProject,
} from '../project-vite-plugin'
import { loadNibConfig, resolveBasePath } from '../project-config'
import { configuredDerivedPages, configuredPageSources } from '../content/page-sources'
import {
  createPublicationArtifactPlan,
  createPublicationManifestFromRoutes,
  createPublicationManifestRoute,
  previewCanonicalRedirect,
  previewExtensionlessPageArtifacts,
  type PublicationArtifactPlanEntry,
  type PublicationManifestRoute,
} from '../publication'
import {
  resolveVitePluginContributions,
} from '../plugin'
import { writeHostingArtifacts } from '../hosting-writer'
import type { RenderedOutput, TrailingSlash } from '../types'
import type {
  ClientProvenanceReport,
  ClientProvenanceRoute,
} from '../client-provenance'
import { nibDataPages, nibDerivedPages, nibMarkdown } from '../vite-plugin'
import { targetBoundaryGuard } from '../target-boundary'
import { pageStyleOwnershipGuard } from '../style-ownership'
import {
  ENHANCEMENT_MODULE_GLOB,
  enhancementFileToId,
} from '../enhancement-paths'
import { ISLAND_MODULE_GLOB, islandFileToId } from '../island-paths'
import {
  ROUTE_CLIENT_ASSET_MARKER,
  htmlTemplate,
  manifestModulePreloads,
  manifestStylesheets,
  type ManifestEntry,
  type ViteManifest,
} from './html-template'

export { manifestModulePreloads } from './html-template'

export interface SiteOperationOptions {
  root: string
}

interface BuildTemplate {
  template: string
  manifest: ViteManifest
  runtimeEntries: Readonly<{
    readonly client?: ManifestEntry
    readonly enhancements?: ManifestEntry
    readonly islands?: ManifestEntry
  }>
  enhancementAssets: ReadonlyMap<string, RouteClientAssets>
  islandAssets: ReadonlyMap<string, RouteClientAssets>
  emittedAssets: ReadonlySet<string>
  runtimePreloads: RuntimeEntryPreloads
}

/** @internal Exported for framework contract tests, not from the package API. */
export interface RouteClientAssets {
  readonly preloads: readonly string[]
  readonly stylesheets: readonly string[]
}

/** @internal Exported for framework contract tests, not from the package API. */
export interface RuntimeEntryPreloads {
  readonly enhancements: readonly string[]
  readonly islands: readonly string[]
}

function publicationBatchSize(): number {
  return Math.max(1, Math.min(8, os.availableParallelism()))
}

function normalizedAllowedHosts(
  hosts: readonly string[] | undefined,
): string[] | undefined {
  if (hosts === undefined) return undefined
  if (hosts.some((host) => typeof host !== 'string' || host.trim() === '')) {
    throw new Error('Nib allowedHosts must contain non-empty host names')
  }
  return [...new Set(hosts.map((host) => host.trim()))]
}

async function waitForAll(
  promises: readonly Promise<unknown>[],
): Promise<void> {
  const results = await Promise.allSettled(promises)
  const failure = results.find((result): result is PromiseRejectedResult => (
    result.status === 'rejected'
  ))
  if (failure !== undefined) throw failure.reason
}

function baseHref(base: string, file: string): string {
  return `${base}${file.replace(/^\/+/, '')}`
}

/** @internal Exported for framework contract tests, not from the package API. */
export async function siteViteConfig(
  root: string,
  command: 'build' | 'serve',
  target: 'client' | 'server' | 'development',
): Promise<{
  base: string
  trailingSlash: TrailingSlash | undefined
  hosting: import('../types').NibHostingConfig | undefined
  hasAppClient: boolean
  config: InlineConfig
}> {
  const loaded = await loadNibConfig(root, command)
  const base = resolveBasePath(loaded.config)
  const pluginContext = Object.freeze({
    command,
    mode: command === 'serve' ? 'development' as const : 'production' as const,
    target,
    root,
    base,
    configPath: loaded.configPath,
  })
  const pageSources = configuredPageSources(loaded.config)
  const derivedPageDefinitions = configuredDerivedPages(loaded.config)
  const hasAppClient = await fs.access(path.join(root, 'src/client.ts'))
    .then(() => true, () => false)
  const extensions = pageSourceExtensions(pageSources)
  const appVitePlugins = loaded.config.vite === undefined
    ? []
    : await resolveVitePluginContributions([
      { name: 'nib.config.ts', vite: loaded.config.vite },
    ], pluginContext)
  const contributedPlugins = await resolveVitePluginContributions(
    loaded.config.plugins ?? [],
    pluginContext,
  )
  return {
    base,
    trailingSlash: loaded.config.trailingSlash,
    hosting: loaded.config.hosting,
    hasAppClient,
    config: {
      appType: 'custom',
      base,
      configFile: false,
      define: {
        __NIB_BASE_PATH__: JSON.stringify(base),
        __NIB_TRAILING_SLASH__: JSON.stringify(loaded.config.trailingSlash ?? 'ignore'),
      },
      plugins: [
        targetBoundaryGuard(target),
        pageStyleOwnershipGuard(root, target),
        nibMarkdown(loaded.configPath),
        nibDataPages(loaded.configPath, pageSources),
        nibDerivedPages(loaded.configPath, derivedPageDefinitions),
        ...appVitePlugins,
        ...contributedPlugins,
        react(),
        nibProject(
          loaded.configPath,
          root,
          extensions,
          command,
          pageSourcePatterns(pageSources),
          hasAppClient,
        ),
        nibClientEntry(),
      ],
      resolve: {
        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      },
      root,
      ssr: {
        noExternal: ['@briansunter/nib'],
      },
    },
  }
}

async function readBuildTemplate(
  clientDirectory: string,
  base: string,
  hasEnhancements: boolean,
  hasIslands: boolean,
  hasAppClient: boolean,
): Promise<BuildTemplate> {
  const manifest = JSON.parse(
    await fs.readFile(path.join(clientDirectory, '.vite/manifest.json'), 'utf8'),
  ) as ViteManifest
  const entries = Object.values(manifest)
  const enhancements = entries.find((entry) => (
    entry.isEntry && entry.name === 'enhancements'
  ))
  const islands = entries.find((entry) => entry.isEntry && entry.name === 'islands')
  const client = entries.find((entry) => entry.isEntry && entry.name === 'client')
  if (hasEnhancements && enhancements === undefined) {
    throw new Error('Nib client build did not produce its enhancement runtime entry')
  }
  if (hasIslands && islands === undefined) {
    throw new Error('Nib client build did not produce its island runtime entry')
  }
  if (hasAppClient && client === undefined) {
    throw new Error('Nib client build did not produce its app client entry')
  }
  const preloads = (entry: ManifestEntry): string[] => (
    manifestModulePreloads(manifest, entry).map((file) => baseHref(base, file))
  )
  // Only entry-owned CSS is global. Styles imported by an enhancement or
  // island module are linked only from routes that render that module.
  const styles = entries
    .filter((entry) => entry.isEntry)
    .flatMap((entry) => manifestStylesheets(manifest, entry))
    .filter((file, index, all) => all.indexOf(file) === index)
  const routeAssets = (
    dynamicImports: readonly string[],
    fileToId: (file: string) => string,
  ): Map<string, RouteClientAssets> => {
    const assets = new Map<string, RouteClientAssets>()
    for (const module of dynamicImports) {
      try {
        const id = fileToId(module)
        const entry = manifest[module]
        if (entry !== undefined) {
          assets.set(id, {
            preloads: [entry.file, ...manifestModulePreloads(manifest, entry)],
            stylesheets: manifestStylesheets(manifest, entry),
          })
        }
      } catch {
        // Only convention-owned modules are route asset candidates.
      }
    }
    return assets
  }
  const enhancementAssets = routeAssets(
    enhancements?.dynamicImports ?? [],
    enhancementFileToId,
  )
  const islandAssets = routeAssets(
    islands?.dynamicImports ?? [],
    islandFileToId,
  )
  const enhancementPreloads = enhancements === undefined ? [] : preloads(enhancements)
  const islandPreloads = islands === undefined ? [] : preloads(islands)
  const clientPreloads = client === undefined ? [] : preloads(client)
  const template = htmlTemplate({
    ...(enhancements === undefined
      ? {}
      : {
          enhancement: {
            source: baseHref(base, enhancements.file),
            preloads: enhancementPreloads,
          },
        }),
    ...(islands === undefined
      ? {}
      : {
          island: {
            source: baseHref(base, islands.file),
            preloads: islandPreloads,
          },
        }),
    ...(client === undefined
      ? {}
      : {
          client: {
            source: baseHref(base, client.file),
            preloads: clientPreloads,
          },
        }),
    stylesheets: styles.map((file) => baseHref(base, file)),
  })
  const emittedAssets = new Set([
    ...styles.map((file) => baseHref(base, file)),
    ...clientPreloads,
  ])
  return {
    template,
    manifest,
    runtimeEntries: {
      ...(client === undefined ? {} : { client }),
      ...(enhancements === undefined ? {} : { enhancements }),
      ...(islands === undefined ? {} : { islands }),
    },
    enhancementAssets,
    islandAssets,
    emittedAssets,
    runtimePreloads: {
      enhancements: enhancementPreloads,
      islands: islandPreloads,
    },
  }
}

async function removePrivateInertClientEntry(clientDirectory: string): Promise<void> {
  const manifestFile = path.join(clientDirectory, '.vite/manifest.json')
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8')) as ViteManifest
  const inert = Object.values(manifest).find((entry) => (
    entry.isEntry && entry.name === 'nib-empty-client'
  ))
  if (inert === undefined) {
    throw new Error('Nib client build did not produce its private inert entry')
  }
  const inertFile = path.join(clientDirectory, inert.file)
  await fs.rm(inertFile, { force: true })
  await fs.rmdir(path.dirname(inertFile)).catch((error: unknown) => {
    const code = fileSystemErrorCode(error)
    if (code !== 'ENOTEMPTY' && code !== 'ENOENT') throw error
  })
  await fs.rm(path.dirname(manifestFile), { recursive: true, force: true })
}

function publicationPreviewPlugin(
  base: string,
  trailingSlash: 'always' | 'never' | 'ignore' | undefined,
  clientDirectory: string,
): Plugin {
  return {
    name: 'nib-route-publication-preview',
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const redirect = request.url === undefined
          ? undefined
          : previewCanonicalRedirect(request.url, base, trailingSlash)
        if (redirect !== undefined) {
          response.statusCode = 301
          response.setHeader('Location', redirect)
          response.end()
          return
        }
        const acceptsHtml = request.headers.accept?.includes('text/html') ?? false
        const artifacts = request.url === undefined || !acceptsHtml
          ? undefined
          : previewExtensionlessPageArtifacts(request.url, base, trailingSlash)
        for (const artifact of artifacts ?? []) {
          try {
            const body = await fs.readFile(path.join(clientDirectory, artifact))
            response.statusCode = 200
            response.setHeader('Content-Type', 'text/html; charset=utf-8')
            response.end(body)
            return
          } catch {
            // Try a parent route's index before delegating to Vite.
          }
        }
        next()
      })
    },
  }
}

function fileSystemErrorCode(error: unknown): string | undefined {
  return error !== null && typeof error === 'object' && 'code' in error
    && typeof error.code === 'string'
    ? error.code
    : undefined
}

async function assertPublicationArtifactsAvailable(
  clientDirectory: string,
  plan: readonly PublicationArtifactPlanEntry[],
): Promise<void> {
  const checkedDirectories = new Set<string>()
  for (const { routePath, artifact } of plan) {
    const segments = artifact.split('/')
    let candidate = clientDirectory
    for (const [index, segment] of segments.entries()) {
      candidate = path.join(candidate, segment)
      const isArtifact = index === segments.length - 1
      if (!isArtifact && checkedDirectories.has(candidate)) continue

      let stats
      try {
        stats = await fs.lstat(candidate)
      } catch (error) {
        if (fileSystemErrorCode(error) === 'ENOENT') break
        throw error
      }
      if (!isArtifact && stats.isDirectory() && !stats.isSymbolicLink()) {
        checkedDirectories.add(candidate)
        continue
      }
      throw new Error(
        `Nib cannot publish route ${JSON.stringify(routePath)} to `
        + `${JSON.stringify(artifact)} because the client build already owns that artifact`,
      )
    }
  }
}

/** @internal Exported for framework contract tests, not from the package API. */
export function routeClientAssets(
  page: Extract<RenderedOutput, { kind: 'page' }>['page'],
  enhancementAssets: ReadonlyMap<string, RouteClientAssets>,
  islandAssets: ReadonlyMap<string, RouteClientAssets>,
  emittedAssets: ReadonlySet<string>,
  base: string,
  runtimePreloads: RuntimeEntryPreloads = {
    enhancements: [],
    islands: [],
  },
): string {
  const emitted = new Set([
    ...emittedAssets,
    ...(page.enhancements.length === 0 ? [] : runtimePreloads.enhancements),
    ...(page.islands.length === 0 ? [] : runtimePreloads.islands),
  ])
  const links: string[] = []
  const addRouteAssets = (
    owner: 'enhancements' | 'islands',
    modules: readonly { id: string; when: 'load' | 'visible' }[],
    assets: ReadonlyMap<string, RouteClientAssets>,
  ) => {
    for (const id of new Set(modules.map((module) => module.id))) {
      for (const file of assets.get(id)?.stylesheets ?? []) {
        const href = baseHref(base, file)
        if (emitted.has(href)) continue
        emitted.add(href)
        links.push(
          `<link data-nib-${owner.slice(0, -1)}-style rel="stylesheet" href="${href}" />`,
        )
      }
    }
    for (const id of new Set(
      modules.filter(({ when }) => when === 'load').map(({ id }) => id),
    )) {
      for (const file of assets.get(id)?.preloads ?? []) {
        const href = baseHref(base, file)
        if (emitted.has(href)) continue
        emitted.add(href)
        links.push(
          `<link data-nib-runtime-preload="${owner}" rel="modulepreload" href="${href}" />`,
        )
      }
    }
  }
  addRouteAssets('islands', page.islands, islandAssets)
  addRouteAssets('enhancements', page.enhancements, enhancementAssets)
  return links.join('\n    ')
}

/** The same route ownership calculation used by HTML emission, exposed for the
 * build's typed client provenance report. */
export function routeClientProvenance(
  page: Extract<RenderedOutput, { kind: 'page' }>['page'],
  enhancementAssets: ReadonlyMap<string, RouteClientAssets>,
  islandAssets: ReadonlyMap<string, RouteClientAssets>,
  emittedAssets: ReadonlySet<string>,
  base: string,
  runtimePreloads: RuntimeEntryPreloads = { enhancements: [], islands: [] },
): Pick<ClientProvenanceRoute, 'javascript' | 'stylesheets' | 'preloads'> {
  const emitted = new Set([
    ...emittedAssets,
    ...(page.enhancements.length === 0 ? [] : runtimePreloads.enhancements),
    ...(page.islands.length === 0 ? [] : runtimePreloads.islands),
  ])
  const javascript: string[] = []
  const stylesheets: string[] = []
  const preloads: string[] = []
  const add = (
    modules: readonly { readonly id: string; readonly when: 'load' | 'visible' }[],
    assets: ReadonlyMap<string, RouteClientAssets>,
  ) => {
    for (const id of new Set(modules.map((module) => module.id))) {
      const module = assets.get(id)
      for (const file of module?.stylesheets ?? []) {
        const href = baseHref(base, file)
        if (emitted.has(href)) continue
        emitted.add(href)
        stylesheets.push(href)
      }
      if (modules.some((entry) => entry.id === id && entry.when === 'load')) {
        for (const file of module?.preloads ?? []) {
          const href = baseHref(base, file)
          if (emitted.has(href)) continue
          emitted.add(href)
          preloads.push(href)
          javascript.push(href)
        }
      }
    }
  }
  add(page.islands, islandAssets)
  add(page.enhancements, enhancementAssets)
  return { javascript, stylesheets, preloads }
}

function renderedBody(
  template: string,
  output: RenderedOutput,
  enhancementAssets: ReadonlyMap<string, RouteClientAssets> = new Map(),
  islandAssets: ReadonlyMap<string, RouteClientAssets> = new Map(),
  emittedAssets: ReadonlySet<string> = new Set(),
  base = '/',
  runtimePreloads: RuntimeEntryPreloads = {
    enhancements: [],
    islands: [],
  },
): string {
  const routeTemplate = output.kind === 'page'
    ? template.replace(
      ROUTE_CLIENT_ASSET_MARKER,
      routeClientAssets(
        output.page,
        enhancementAssets,
        islandAssets,
        emittedAssets,
        base,
        runtimePreloads,
      ),
    )
    : template.replace(ROUTE_CLIENT_ASSET_MARKER, '')
  return output.kind === 'page'
    ? renderDocument(routeTemplate, output.page)
    : output.kind === 'resource'
      ? output.body
      : renderRedirectDocument(output.destination)
}

async function renderAndWritePublication(
  server: { render(url: string): RenderedOutput },
  plan: readonly PublicationArtifactPlanEntry[],
  clientDirectory: string,
  template: string,
  enhancementAssets: ReadonlyMap<string, RouteClientAssets>,
  islandAssets: ReadonlyMap<string, RouteClientAssets>,
  emittedAssets: ReadonlySet<string>,
  base: string,
  runtimePreloads: RuntimeEntryPreloads,
): Promise<{
  readonly routes: readonly PublicationManifestRoute[]
  readonly clientRoutes: readonly ClientProvenanceRoute[]
}> {
  const manifestRoutes: PublicationManifestRoute[] = []
  const clientRoutes: ClientProvenanceRoute[] = []
  const batchSize = publicationBatchSize()
  for (let start = 0; start < plan.length; start += batchSize) {
    // Render in canonical route order before starting this batch's writes.
    // This keeps stateful render hooks deterministic while bounding retained
    // page bodies to one small batch.
    const batch = plan.slice(start, start + batchSize).map(({ routePath, artifact }) => {
      const output = server.render(routePath)
      manifestRoutes.push(createPublicationManifestRoute({ routePath, artifact, output }))
      if (output.kind === 'page') {
        const assets = routeClientProvenance(
          output.page,
          enhancementAssets,
          islandAssets,
          emittedAssets,
          base,
          runtimePreloads,
        )
        clientRoutes.push({
          path: routePath,
          artifact,
          enhancements: output.page.enhancements,
          islands: output.page.islands,
          ...assets,
        })
      }
      return {
        artifact,
        body: renderedBody(
          template,
          output,
          enhancementAssets,
          islandAssets,
          emittedAssets,
          base,
          runtimePreloads,
        ),
      }
    })
    await waitForAll(batch.map(async ({ artifact, body }) => {
      const primaryFile = path.join(clientDirectory, artifact)
      await fs.mkdir(path.dirname(primaryFile), { recursive: true })
      await fs.writeFile(primaryFile, body)
    }))
  }
  return { routes: manifestRoutes, clientRoutes }
}

async function promoteStagedOutput(
  stagingDirectory: string,
  outputDirectory: string,
): Promise<void> {
  const suffix = path.basename(path.dirname(stagingDirectory))
    .replace(/^\.nib-build-/, '')
  const backupDirectory = path.join(
    path.dirname(outputDirectory),
    `.nib-previous-${suffix}`,
  )
  let previousMoved = false
  try {
    await fs.rename(outputDirectory, backupDirectory)
    previousMoved = true
  } catch (error) {
    if (fileSystemErrorCode(error) !== 'ENOENT') throw error
  }

  try {
    await fs.rename(stagingDirectory, outputDirectory)
  } catch (promotionError) {
    if (!previousMoved) throw promotionError
    try {
      await fs.rename(backupDirectory, outputDirectory)
    } catch (rollbackError) {
      throw new AggregateError(
        [promotionError, rollbackError],
        `Nib could not publish the staged build or restore ${outputDirectory}; `
        + `the previous build remains at ${backupDirectory}`,
      )
    }
    throw promotionError
  }

  if (previousMoved) {
    await fs.rm(backupDirectory, { recursive: true, force: true })
  }
}

async function buildStagedSite(root: string, output: string): Promise<void> {
  const clientDirectory = path.join(output, 'client')
  const serverDirectory = path.join(output, 'server')
  const stylePath = path.join(root, 'src/style.css')
  const hasStyles = await fs.access(stylePath).then(() => true, () => false)
  const hasEnhancements = (await glob(ENHANCEMENT_MODULE_GLOB.slice(1), {
    cwd: root,
    onlyFiles: true,
  })).length > 0
  const hasIslands = (await glob(
    ISLAND_MODULE_GLOB.map((pattern) => pattern.replace(/^(!?)\//, '$1')),
    { cwd: root, onlyFiles: true },
  )).length > 0

  const {
    base,
    trailingSlash,
    hosting,
    hasAppClient,
    config: clientConfig,
  } = await siteViteConfig(root, 'build', 'client')
  const clientInputs = {
    ...(hasEnhancements ? { enhancements: NIB_ENHANCEMENT_ENTRY } : {}),
    ...(hasIslands ? { islands: NIB_ISLAND_ENTRY } : {}),
    ...(hasAppClient ? { client: NIB_APP_CLIENT_ENTRY } : {}),
    ...(hasStyles ? { styles: stylePath } : {}),
  }
  // Even a fully static project runs the client-target Vite graph so project
  // plugins retain build hooks and emitted assets. The inert entry is never
  // linked from generated documents.
  const rollupInputs = Object.keys(clientInputs).length === 0
    ? { 'nib-empty-client': NIB_EMPTY_CLIENT_ENTRY }
    : clientInputs
  await viteBuild({
    ...clientConfig,
    build: {
      emptyOutDir: true,
      manifest: true,
      outDir: clientDirectory,
      rollupOptions: { input: rollupInputs },
    },
  })
  const buildTemplate = await readBuildTemplate(
    clientDirectory,
    base,
    hasEnhancements,
    hasIslands,
    hasAppClient,
  )
  if (Object.keys(clientInputs).length === 0) {
    await removePrivateInertClientEntry(clientDirectory)
  }
  const { base: serverBase, config: serverConfig } = await siteViteConfig(root, 'build', 'server')
  if (serverBase !== base) {
    throw new Error(`Nib base changed between client and server builds: ${base} !== ${serverBase}`)
  }
  await viteBuild({
    ...serverConfig,
    build: {
      copyPublicDir: false,
      emptyOutDir: true,
      outDir: serverDirectory,
      rollupOptions: {
        input: NIB_SERVER_ENTRY,
        output: {
          entryFileNames: 'entry-server.js',
        },
      },
      ssr: true,
    },
  })

  const serverEntry = path.join(serverDirectory, 'entry-server.js')
  const server = await import(`${pathToFileURL(serverEntry).href}?t=${Date.now()}`) as {
    paths: readonly string[]
    render(url: string): RenderedOutput
    finalize(context: {
      clientDirectory: string
      publication: import('../publication').PublicationManifest
    }): Promise<void>
  }
  const routePaths = [...server.paths, '/404']
  const plan = createPublicationArtifactPlan(routePaths, trailingSlash)
  await assertPublicationArtifactsAvailable(clientDirectory, plan)
  const rendered = await renderAndWritePublication(
    server,
    plan,
    clientDirectory,
    buildTemplate.template,
    buildTemplate.enhancementAssets,
    buildTemplate.islandAssets,
    buildTemplate.emittedAssets,
    base,
    buildTemplate.runtimePreloads,
  )
  const publicationManifest = createPublicationManifestFromRoutes(
    base,
    trailingSlash,
    rendered.routes,
  )
  // Finalizers can inspect and enrich the already-published HTML while still
  // sharing the same output directory as framework-owned artifacts.
  await server.finalize({
    clientDirectory,
    publication: publicationManifest,
  })
  const publicationDirectory = path.join(clientDirectory, '.nib')
  await fs.mkdir(publicationDirectory, { recursive: true })
  await fs.writeFile(
    path.join(publicationDirectory, 'publication.json'),
    `${JSON.stringify(publicationManifest, null, 2)}\n`,
  )
  const runtime = (
    entry: ManifestEntry | undefined,
    preloads: readonly string[],
  ) => entry === undefined ? undefined : {
    file: baseHref(base, entry.file),
    preloads,
  }
  const moduleRecord = (
    assets: ReadonlyMap<string, RouteClientAssets>,
  ) => Object.fromEntries([...assets.entries()].map(([id, value]) => [id, {
    id,
    file: baseHref(base, value.preloads[0] ?? ''),
    stylesheets: value.stylesheets.map((file) => baseHref(base, file)),
    preloads: value.preloads.map((file) => baseHref(base, file)),
  }]))
  const clientRuntime = buildTemplate.runtimeEntries.client === undefined
    ? undefined
    : runtime(
      buildTemplate.runtimeEntries.client,
      manifestModulePreloads(
        buildTemplate.manifest,
        buildTemplate.runtimeEntries.client,
      ).map((file) => baseHref(base, file)),
    )
  const enhancementRuntime = buildTemplate.runtimeEntries.enhancements === undefined
    ? undefined
    : runtime(
      buildTemplate.runtimeEntries.enhancements,
      buildTemplate.runtimePreloads.enhancements,
    )
  const islandRuntime = buildTemplate.runtimeEntries.islands === undefined
    ? undefined
    : runtime(
      buildTemplate.runtimeEntries.islands,
      buildTemplate.runtimePreloads.islands,
    )
  // Runtime entries and route ownership are emitted from the same Vite graph
  // and renderer facts that produced the HTML. Consumers can enforce generic
  // enhancement/island/preload invariants without reparsing markup.
  const clientReport: ClientProvenanceReport = {
    version: 1,
    runtimes: {
      ...(clientRuntime === undefined ? {} : { client: clientRuntime }),
      ...(enhancementRuntime === undefined ? {} : { enhancements: enhancementRuntime }),
      ...(islandRuntime === undefined ? {} : { islands: islandRuntime }),
    },
    modules: {
      enhancements: moduleRecord(buildTemplate.enhancementAssets),
      islands: moduleRecord(buildTemplate.islandAssets),
    },
    routes: rendered.clientRoutes,
  }
  await fs.writeFile(
    path.join(publicationDirectory, 'client.json'),
    `${JSON.stringify(clientReport, null, 2)}\n`,
  )
  await writeHostingArtifacts(clientDirectory, publicationManifest, hosting)
}

async function buildSiteInProduction(options: SiteOperationOptions): Promise<void> {
  const root = path.resolve(options.root)
  const output = path.join(root, 'dist')
  const transactionDirectory = await fs.mkdtemp(path.join(root, '.nib-build-'))
  const stagingDirectory = path.join(transactionDirectory, 'dist')
  try {
    await buildStagedSite(root, stagingDirectory)
    await promoteStagedOutput(stagingDirectory, output)
  } catch (error) {
    try {
      await fs.rm(transactionDirectory, { recursive: true, force: true })
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Nib build failed and could not clean staging directory ${transactionDirectory}`,
      )
    }
    throw error
  }
  await fs.rm(transactionDirectory, { recursive: true, force: true })
}

export async function buildSite(options: SiteOperationOptions): Promise<void> {
  const previousNodeEnvironment = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    await buildSiteInProduction(options)
  } finally {
    if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnvironment
  }
}

export interface DevSiteOptions extends SiteOperationOptions {
  host?: string
  port?: number
  /** Additional Host header values accepted by Vite; loopback remains default. */
  allowedHosts?: readonly string[]
}

export async function startDevSite(options: DevSiteOptions): Promise<ViteDevServer> {
  const root = path.resolve(options.root)
  const allowedHosts = normalizedAllowedHosts(options.allowedHosts)
  const { hasAppClient, config } = await siteViteConfig(root, 'serve', 'development')
  const vite = await createViteServer({
    ...config,
    server: {
      ...(options.host === undefined ? {} : { host: options.host }),
      ...(allowedHosts === undefined ? {} : { allowedHosts }),
      port: options.port ?? 5173,
      preTransformRequests: false,
    },
  })
  const hasStyles = await fs.access(path.join(root, 'src/style.css')).then(() => true, () => false)
  const template = htmlTemplate({
    enhancement: {
      source: `/@id/${NIB_ENHANCEMENT_ENTRY}`,
      preloads: [],
    },
    island: {
      source: `/@id/${NIB_ISLAND_ENTRY}`,
      preloads: [],
    },
    ...(!hasAppClient
      ? {}
      : {
          client: {
            source: `/@id/${NIB_APP_CLIENT_ENTRY}`,
            preloads: [],
          },
        }),
    stylesheets: hasStyles ? ['/src/style.css'] : [],
  })
  vite.middlewares.use(async (request, response, next) => {
    try {
      const url = request.url ?? '/'
      const transformed = await vite.transformIndexHtml(url, template)
      const environment = vite.environments.ssr
      if (!isRunnableDevEnvironment(environment)) {
        throw new Error('Nib requires a runnable Vite SSR environment')
      }
      const server = await environment.runner.import(NIB_SERVER_ENTRY) as {
        render(url: string): RenderedOutput
      }
      const output = server.render(url)
      if (output.kind === 'redirect') {
        response.statusCode = output.status
        response.setHeader('Location', output.destination)
        response.end()
        return
      }
      if (output.kind === 'resource') {
        response.statusCode = output.status
        response.setHeader('Content-Type', output.contentType)
        response.end(output.body)
        return
      }
      response.statusCode = output.page.status
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.end(renderDocument(transformed, output.page))
    } catch (error) {
      next(error)
    }
  })
  await vite.listen()
  return vite
}

export interface PreviewSiteOptions extends SiteOperationOptions {
  host?: string
  port?: number
  /** Additional Host header values accepted by Vite preview. */
  allowedHosts?: readonly string[]
}

export async function previewSite(options: PreviewSiteOptions): Promise<PreviewServer> {
  const root = path.resolve(options.root)
  const allowedHosts = normalizedAllowedHosts(options.allowedHosts)
  const loaded = await loadNibConfig(root, 'serve')
  const base = resolveBasePath(loaded.config)
  return vitePreview({
    base,
    build: { outDir: path.join(root, 'dist/client') },
    configFile: false,
    plugins: [publicationPreviewPlugin(base, loaded.config.trailingSlash, path.join(root, 'dist/client'))],
    preview: {
      ...(options.host === undefined ? {} : { host: options.host }),
      ...(options.port === undefined ? {} : { port: options.port }),
      ...(allowedHosts === undefined ? {} : { allowedHosts }),
    },
    root,
  })
}
