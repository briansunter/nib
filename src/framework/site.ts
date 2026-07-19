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
  type InlineConfig,
  type PreviewServer,
  type ViteDevServer,
} from 'vite'
import { renderDocument, renderRedirectDocument } from './document'
import { pageSourceExtensions } from './content'
import { nibIslandsEntry } from './island-vite-plugin'
import {
  NIB_CLIENT_ENTRY,
  NIB_SERVER_ENTRY,
  nibProject,
} from './project-vite-plugin'
import { loadNibConfig, resolveBasePath } from './project-config'
import { isFileRoute } from './paths'
import {
  resolvePluginSetupContributions,
  resolveVitePluginContributions,
} from './plugin'
import type { RenderedOutput } from './types'
import { nibDataPages, nibMarkdown } from './vite-plugin'

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

function htmlTemplate(base: string, islandEntry: string, stylesheets: string[]): string {
  const styles = stylesheets
    .map((file) => `<link rel="stylesheet" href="${baseHref(base, file)}" />`)
    .join('\n    ')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!--head-outlet-->
    ${styles}
    <!--nib-islands-entry--><script data-nib-islands type="module" src="${baseHref(base, islandEntry)}"></script>
  </head>
  <body>
    <div id="root"><!--ssr-outlet--></div>
  </body>
</html>`
}

function devHtmlTemplate(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!--head-outlet-->
    <link rel="stylesheet" href="/src/style.css" />
    <!--nib-islands-entry--><script data-nib-islands type="module" src="/@id/${NIB_CLIENT_ENTRY}"></script>
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
): Promise<{ base: string; config: InlineConfig }> {
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
    pluginContext,
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
    config: {
      appType: 'custom',
      base,
      configFile: false,
      define: {
        __NIB_BASE_PATH__: JSON.stringify(base),
        __NIB_TRAILING_SLASH__: JSON.stringify(loaded.config.trailingSlash ?? 'ignore'),
      },
      plugins: [
        nibMarkdown(loaded.configPath),
        nibDataPages(loaded.configPath, pageSources, pluginContext),
        ...appVitePlugins,
        ...contributedPlugins,
        react(),
        nibProject(loaded.configPath, root, extensions, command),
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

async function readBuildTemplate(clientDirectory: string, base: string): Promise<string> {
  const manifest = JSON.parse(
    await fs.readFile(path.join(clientDirectory, '.vite/manifest.json'), 'utf8'),
  ) as ViteManifest
  const entries = Object.values(manifest)
  const islands = entries.find((entry) => entry.isEntry && entry.name === 'islands')
  if (!islands) throw new Error('Nib client build did not produce an island runtime entry')
  const styles = entries
    .flatMap((entry) => [
      ...(entry.css ?? []),
      ...(entry.isEntry && entry.file.endsWith('.css') ? [entry.file] : []),
    ])
    .filter((file, index, all) => all.indexOf(file) === index)
  return htmlTemplate(base, islands.file, styles)
}

function outputFile(clientDirectory: string, routePath: string): string {
  const normalized = routePath.replace(/^\/+|\/+$/g, '')
  if (isFileRoute(routePath)) return path.join(clientDirectory, normalized)
  return path.join(
    clientDirectory,
    routePath === '/' ? 'index.html' : `${routePath.replace(/^\/+/, '')}/index.html`,
  )
}

async function buildSiteInProduction(options: SiteOperationOptions): Promise<void> {
  const root = path.resolve(options.root)
  const output = path.join(root, 'dist')
  const clientDirectory = path.join(output, 'client')
  const serverDirectory = path.join(output, 'server')
  const stylePath = path.join(root, 'src/style.css')
  const hasStyles = await fs.access(stylePath).then(() => true, () => false)

  await fs.rm(output, { recursive: true, force: true })
  const { base, config: clientConfig } = await siteViteConfig(root, 'build', 'client')
  await viteBuild({
    ...clientConfig,
    build: {
      emptyOutDir: true,
      manifest: true,
      outDir: clientDirectory,
      rollupOptions: {
        input: {
          islands: NIB_CLIENT_ENTRY,
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

  const template = await readBuildTemplate(clientDirectory, base)
  const serverEntry = path.join(serverDirectory, 'entry-server.js')
  const server = await import(`${pathToFileURL(serverEntry).href}?t=${Date.now()}`) as {
    paths: readonly string[]
    render(url: string): RenderedOutput
    finalize(context: { clientDirectory: string }): Promise<void>
  }
  const rendered = server.paths.map((routePath) => ({ routePath, output: server.render(routePath) }))
  const notFound = { routePath: '/404', output: server.render('/404') }
  await server.finalize({
    clientDirectory,
  })
  await mapWithConcurrency([...rendered, notFound], htmlWriteConcurrency(), async ({ routePath, output }) => {
    const file = routePath === '/404'
      ? path.join(clientDirectory, '404.html')
      : outputFile(clientDirectory, routePath)
    await fs.mkdir(path.dirname(file), { recursive: true })
    const body = output.kind === 'page'
      ? renderDocument(template, output.page)
      : output.kind === 'resource'
        ? output.body
        : renderRedirectDocument(output.destination)
    await fs.writeFile(file, body)
  })
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
}

export async function startDevSite(options: DevSiteOptions): Promise<ViteDevServer> {
  const root = path.resolve(options.root)
  const { config } = await siteViteConfig(root, 'serve', 'development')
  const vite = await createViteServer({
    ...config,
    server: {
      ...(options.host === undefined ? {} : { host: options.host }),
      port: options.port ?? 5173,
      preTransformRequests: false,
    },
  })
  const template = devHtmlTemplate()
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
}

export async function previewSite(options: PreviewSiteOptions): Promise<PreviewServer> {
  const root = path.resolve(options.root)
  const loaded = await loadNibConfig(root, 'serve')
  return vitePreview({
    base: resolveBasePath(loaded.config),
    build: { outDir: path.join(root, 'dist/client') },
    configFile: false,
    preview: {
      ...(options.host === undefined ? {} : { host: options.host }),
      ...(options.port === undefined ? {} : { port: options.port }),
    },
    root,
  })
}
