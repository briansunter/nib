import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
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
import { renderDocument } from './document'
import { nibIslandsEntry } from './island-vite-plugin'
import {
  NIB_CLIENT_ENTRY,
  NIB_SERVER_ENTRY,
  nibProject,
} from './project-vite-plugin'
import { loadNibConfig, resolveBasePath } from './project-config'
import type { RenderedPage } from './types'
import { nibMarkdown } from './vite-plugin'

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

async function siteViteConfig(
  root: string,
  command: 'build' | 'serve',
): Promise<{ base: string; config: InlineConfig }> {
  const loaded = await loadNibConfig(root, command)
  const base = resolveBasePath(loaded.config)
  return {
    base,
    config: {
      appType: 'custom',
      base,
      configFile: false,
      define: {
        __NIB_BASE_PATH__: JSON.stringify(base),
      },
      plugins: [
        nibMarkdown(),
        react(),
        tailwindcss(),
        nibProject(loaded.configPath),
        nibIslandsEntry(),
      ],
      resolve: {
        dedupe: ['react', 'react-dom'],
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
    .flatMap((entry) => entry.css ?? [])
    .filter((file, index, all) => all.indexOf(file) === index)
  return htmlTemplate(base, islands.file, styles)
}

function outputFile(clientDirectory: string, routePath: string): string {
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
  const { base, config } = await siteViteConfig(root, 'build')
  const stylePath = path.join(root, 'src/style.css')
  const hasStyles = await fs.access(stylePath).then(() => true, () => false)

  await fs.rm(output, { recursive: true, force: true })
  await viteBuild({
    ...config,
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
  await viteBuild({
    ...config,
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
    paths: string[]
    render(url: string): RenderedPage
  }
  for (const routePath of server.paths) {
    const file = outputFile(clientDirectory, routePath)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, renderDocument(template, server.render(routePath)))
  }
  await fs.writeFile(
    path.join(clientDirectory, '404.html'),
    renderDocument(template, server.render('/404')),
  )
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
  const { config } = await siteViteConfig(root, 'serve')
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
        render(url: string): RenderedPage
      }
      const page = server.render(url)
      response.statusCode = page.status
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.end(renderDocument(transformed, page))
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
