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
import { renderDocument, renderRedirectDocument } from '../document'
import { pageSourceExtensions, pageSourcePatterns } from '../content'
import { nibIslandsEntry } from '../island-vite-plugin'
import {
  NIB_CLIENT_ENTRY,
  NIB_BEHAVIOR_ENTRY,
  NIB_SERVER_ENTRY,
  NIB_ENHANCEMENT_ENTRY,
  nibProject,
} from '../project-vite-plugin'
import { loadNibConfig, resolveBasePath } from '../project-config'
import {
  configuredClientEntries,
} from '../plugin-contributions'
import { configuredPageSources } from '../content/page-sources'
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
import { nibDataPages, nibMarkdown } from '../vite-plugin'
import { targetBoundaryGuard } from '../target-boundary'
import { pageStyleOwnershipGuard } from '../style-ownership'
import {
  htmlTemplate,
  manifestModulePreloads,
  type ManifestEntry,
  type ViteManifest,
} from './html-template'

export { manifestModulePreloads } from './html-template'

export interface SiteOperationOptions {
  root: string
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
  clientEntries: readonly import('../plugin').NibClientEntry[]
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
  const clientEntries = configuredClientEntries(loaded.config)
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
    clientEntries,
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
        ...appVitePlugins,
        ...contributedPlugins,
        react(),
        nibProject(
          loaded.configPath,
          root,
          extensions,
          command,
          pageSourcePatterns(pageSources),
          clientEntries,
        ),
        nibIslandsEntry(),
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
): Promise<string> {
  const manifest = JSON.parse(
    await fs.readFile(path.join(clientDirectory, '.vite/manifest.json'), 'utf8'),
  ) as ViteManifest
  const entries = Object.values(manifest)
  const islands = entries.find((entry) => entry.isEntry && entry.name === 'islands')
  const behaviors = entries.find((entry) => entry.isEntry && entry.name === 'behaviors')
  const enhancements = entries.find((entry) => entry.isEntry && entry.name === 'enhancements')
  if (!islands) throw new Error('Nib client build did not produce an island runtime entry')
  if (!behaviors) throw new Error('Nib client build did not produce a behavior runtime entry')
  if (hasEnhancements && !enhancements) {
    throw new Error('Nib client build did not produce its configured enhancement entry')
  }
  const preloads = (entry: ManifestEntry): string[] => (
    manifestModulePreloads(manifest, entry).map((file) => baseHref(base, file))
  )
  // Dynamic island and behavior CSS is loaded with its owning chunk. Linking
  // every manifest stylesheet here would make unrelated routes download it.
  const styles = entries
    .filter((entry) => entry.isEntry)
    .flatMap((entry) => [
      ...(entry.css ?? []),
      ...(entry.isEntry && entry.file.endsWith('.css') ? [entry.file] : []),
    ])
    .filter((file, index, all) => all.indexOf(file) === index)
  return htmlTemplate({
    island: {
      source: baseHref(base, islands.file),
      preloads: preloads(islands),
    },
    behavior: {
      source: baseHref(base, behaviors.file),
      preloads: preloads(behaviors),
    },
    ...(enhancements === undefined
      ? {}
      : {
          enhancement: {
            source: baseHref(base, enhancements.file),
            preloads: preloads(enhancements),
          },
        }),
    stylesheets: styles.map((file) => baseHref(base, file)),
  })
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

function renderedBody(template: string, output: RenderedOutput): string {
  return output.kind === 'page'
    ? renderDocument(template, output.page)
    : output.kind === 'resource'
      ? output.body
      : renderRedirectDocument(output.destination)
}

async function renderAndWritePublication(
  server: { render(url: string): RenderedOutput },
  plan: readonly PublicationArtifactPlanEntry[],
  clientDirectory: string,
  template: string,
): Promise<readonly PublicationManifestRoute[]> {
  const manifestRoutes: PublicationManifestRoute[] = []
  const batchSize = publicationBatchSize()
  for (let start = 0; start < plan.length; start += batchSize) {
    // Render in canonical route order before starting this batch's writes.
    // This keeps stateful render hooks deterministic while bounding retained
    // page bodies to one small batch.
    const batch = plan.slice(start, start + batchSize).map(({ routePath, artifact }) => {
      const output = server.render(routePath)
      manifestRoutes.push(createPublicationManifestRoute({ routePath, artifact, output }))
      return { artifact, body: renderedBody(template, output) }
    })
    await waitForAll(batch.map(async ({ artifact, body }) => {
      const primaryFile = path.join(clientDirectory, artifact)
      await fs.mkdir(path.dirname(primaryFile), { recursive: true })
      await fs.writeFile(primaryFile, body)
    }))
  }
  return manifestRoutes
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

  const {
    base,
    trailingSlash,
    hosting,
    clientEntries,
    config: clientConfig,
  } = await siteViteConfig(root, 'build', 'client')
  await viteBuild({
    ...clientConfig,
    build: {
      emptyOutDir: true,
      manifest: true,
      outDir: clientDirectory,
      rollupOptions: {
        input: {
          islands: NIB_CLIENT_ENTRY,
          behaviors: NIB_BEHAVIOR_ENTRY,
          ...(clientEntries.length > 0 ? { enhancements: NIB_ENHANCEMENT_ENTRY } : {}),
          ...(hasStyles ? { styles: stylePath } : {}),
        },
      },
    },
  })
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

  const template = await readBuildTemplate(clientDirectory, base, clientEntries.length > 0)
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
  const manifestRoutes = await renderAndWritePublication(
    server,
    plan,
    clientDirectory,
    template,
  )
  const publicationManifest = createPublicationManifestFromRoutes(
    base,
    trailingSlash,
    manifestRoutes,
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
  const { clientEntries, config } = await siteViteConfig(root, 'serve', 'development')
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
    island: {
      source: `/@id/${NIB_CLIENT_ENTRY}`,
      preloads: [],
    },
    behavior: {
      source: `/@id/${NIB_BEHAVIOR_ENTRY}`,
      preloads: [],
    },
    ...(clientEntries.length === 0
      ? {}
      : {
          enhancement: {
            source: `/@id/${NIB_ENHANCEMENT_ENTRY}`,
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
