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
import { renderDocument, renderRedirectDocument } from './document'
import { pageSourceExtensions, pageSourcePatterns } from './content'
import { nibIslandsEntry } from './island-vite-plugin'
import {
  NIB_CLIENT_ENTRY,
  NIB_BEHAVIOR_ENTRY,
  NIB_SERVER_ENTRY,
  NIB_ENHANCEMENT_ENTRY,
  nibProject,
} from './project-vite-plugin'
import { loadNibConfig, resolveBasePath } from './project-config'
import {
  createPublicationManifest,
  normalizePath,
  previewCanonicalRedirect,
  previewExtensionlessPageArtifacts,
  routeArtifacts,
} from './publication'
import {
  resolvePluginSetupContributions,
  resolveVitePluginContributions,
} from './plugin'
import { writeHostingArtifacts } from './hosting-writer'
import type { RenderedOutput, TrailingSlash } from './types'
import { nibDataPages, nibMarkdown } from './vite-plugin'
import { targetBoundaryGuard } from './target-boundary'
import { pageStyleOwnershipGuard } from './style-ownership'

export interface SiteOperationOptions {
  root: string
}

interface ManifestEntry {
  css?: string[]
  file: string
  isEntry?: boolean
  name?: string
}

type ViteManifest = Record<string, ManifestEntry>

function htmlWriteConcurrency(): number {
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

async function mapWithConcurrency<Value>(
  values: readonly Value[],
  concurrency: number,
  callback: (value: Value) => Promise<void>,
): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next
      next += 1
      await callback(values[index]!)
    }
  }))
}

function baseHref(base: string, file: string): string {
  return `${base}${file.replace(/^\/+/, '')}`
}

interface HtmlTemplateEntries {
  readonly island: string
  readonly behavior: string
  readonly enhancement?: string
  readonly stylesheets: readonly string[]
}

function htmlTemplate(entries: HtmlTemplateEntries): string {
  const styles = entries.stylesheets
    .map((href) => `<link rel="stylesheet" href="${href}" />`)
    .join('\n    ')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!--head-outlet-->
    ${styles}
    <!--nib-islands-entry--><script data-nib-islands type="module" src="${entries.island}"></script>
    <!--nib-behaviors-entry--><script data-nib-behaviors type="module" src="${entries.behavior}"></script>
    ${entries.enhancement === undefined
      ? ''
      : `<script data-nib-enhancements type="module" src="${entries.enhancement}"></script>`}
  </head>
  <body>
    <div id="root"><!--ssr-outlet--></div>
  </body>
</html>`
}

/** @internal Exported for framework contract tests, not from the package API. */
export async function siteViteConfig(
  root: string,
  command: 'build' | 'serve',
  target: 'client' | 'server' | 'development',
): Promise<{
  base: string
  trailingSlash: TrailingSlash | undefined
  hosting: import('./types').NibHostingConfig | undefined
  clientEntries: readonly import('./plugin').NibClientEntry[]
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
  const setup = await resolvePluginSetupContributions(
    loaded.config.plugins ?? [],
    Object.freeze({ ...pluginContext, phase: 'vite-config' as const }),
  )
  const pageSources = [
    ...(loaded.config.pageSources ?? []),
    ...(setup.pageSources ?? []),
  ]
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
    clientEntries: setup.clientEntries ?? [],
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
        nibDataPages(loaded.configPath, pageSources, pluginContext),
        ...appVitePlugins,
        ...contributedPlugins,
        react(),
        nibProject(
          loaded.configPath,
          root,
          extensions,
          command,
          pageSourcePatterns(pageSources),
          setup.clientEntries,
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
  const styles = entries
    .flatMap((entry) => [
      ...(entry.css ?? []),
      ...(entry.isEntry && entry.file.endsWith('.css') ? [entry.file] : []),
    ])
    .filter((file, index, all) => all.indexOf(file) === index)
  return htmlTemplate({
    island: baseHref(base, islands.file),
    behavior: baseHref(base, behaviors.file),
    ...(enhancements === undefined
      ? {}
      : { enhancement: baseHref(base, enhancements.file) }),
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

async function buildSiteInProduction(options: SiteOperationOptions): Promise<void> {
  const root = path.resolve(options.root)
  const output = path.join(root, 'dist')
  const clientDirectory = path.join(output, 'client')
  const serverDirectory = path.join(output, 'server')
  const stylePath = path.join(root, 'src/style.css')
  const hasStyles = await fs.access(stylePath).then(() => true, () => false)

  await fs.rm(output, { recursive: true, force: true })
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
      publication: import('./publication').PublicationManifest
    }): Promise<void>
  }
  const rendered = server.paths.map((routePath) => ({ routePath, output: server.render(routePath) }))
  const notFound = { routePath: '/404', output: server.render('/404') }
  const renderedRoutePaths = rendered.map(({ routePath }) => normalizePath(routePath))
  const outputs = [...rendered, notFound].map(({ routePath, output }) => ({
    routePath,
    output,
    artifact: routePath === '/404'
      ? '404.html'
      : routeArtifacts(
        routePath,
        trailingSlash,
        renderedRoutePaths.some((candidate) => candidate.startsWith(`${normalizePath(routePath)}/`)),
      ).primary,
  }))
  const publicationManifest = createPublicationManifest(base, trailingSlash, outputs)
  await mapWithConcurrency(outputs, htmlWriteConcurrency(), async ({ output, artifact }) => {
    const primaryFile = path.join(clientDirectory, artifact)
    await fs.mkdir(path.dirname(primaryFile), { recursive: true })
    const body = output.kind === 'page'
      ? renderDocument(template, output.page)
      : output.kind === 'resource'
        ? output.body
        : renderRedirectDocument(output.destination)
    await fs.writeFile(primaryFile, body)
  })
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
    island: `/@id/${NIB_CLIENT_ENTRY}`,
    behavior: `/@id/${NIB_BEHAVIOR_ENTRY}`,
    ...(clientEntries.length === 0
      ? {}
      : { enhancement: `/@id/${NIB_ENHANCEMENT_ENTRY}` }),
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
