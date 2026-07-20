import fs from 'node:fs/promises'
import path from 'node:path'
import type { PublicationManifest } from './publication'
import { isFileRoute, normalizePath, stripBasePath } from './publication'

export interface SiteCheckResult {
  readonly output: string
  readonly routeCount: number
  readonly pageCount: number
  readonly resourceCount: number
  readonly redirectCount: number
  readonly checkedLinks: number
  readonly warnings: readonly string[]
}

export interface VerifySiteOptions {
  readonly root: string
  readonly output?: string
}

async function readManifest(output: string): Promise<PublicationManifest> {
  return JSON.parse(await fs.readFile(path.join(output, '.nib/publication.json'), 'utf8')) as PublicationManifest
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(() => true, () => false)
}

function safeArtifact(output: string, artifact: string): string {
  const resolved = path.resolve(output, artifact)
  const root = path.resolve(output)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Publication artifact escapes output directory: ${artifact}`)
  }
  return resolved
}

function routeFileCandidates(output: string, pathname: string): string[] {
  const normalized = normalizePath(pathname)
  if (normalized === '/') return [path.join(output, 'index.html')]
  const relative = normalized.replace(/^\/+/, '')
  return [path.join(output, relative), path.join(output, `${relative}/index.html`)]
}

async function linkExists(output: string, manifest: PublicationManifest, href: string): Promise<boolean> {
  const pathname = stripBasePath(href, manifest.base).split(/[?#]/, 1)[0] || '/'
  if (pathname === '/') return exists(path.join(output, 'index.html'))
  const route = manifest.routes.find((candidate) => normalizePath(candidate.path) === normalizePath(pathname))
  if (route) return exists(safeArtifact(output, route.artifact))
  const candidates = routeFileCandidates(output, pathname)
  for (const candidate of candidates) {
    if (await exists(candidate)) return true
  }
  return false
}

function internalHrefs(html: string): string[] {
  return [...html.matchAll(/\shref=["']([^"']+)["']/gi)]
    .map((match) => match[1]!)
    .filter((href) => href.startsWith('/') && !href.startsWith('//'))
}

function missingAltCount(html: string): number {
  return [...html.matchAll(/<img\b([^>]*)>/gi)]
    .filter(([, attributes]) => !/\salt\s*=\s*["']/i.test(attributes!)).length
}

function pageHasIslandRuntime(html: string): boolean {
  return /\bdata-nib-islands\b/i.test(html) || /<script[^>]+assets\/islands-/i.test(html)
}

/** Verifies the static output through the publication manifest and HTML seams. */
export async function verifySite(options: VerifySiteOptions): Promise<SiteCheckResult> {
  const output = path.resolve(options.output ?? path.join(options.root, 'dist/client'))
  const manifest = await readManifest(output)
  if (manifest.version !== 1) throw new Error(`Unsupported Nib publication manifest version: ${manifest.version}`)
  const seenPaths = new Set<string>()
  const seenArtifacts = new Set<string>()
  const warnings: string[] = []
  let pageCount = 0
  let resourceCount = 0
  let redirectCount = 0
  let checkedLinks = 0

  for (const route of manifest.routes) {
    if (seenPaths.has(route.path)) throw new Error(`Duplicate publication route: ${route.path}`)
    seenPaths.add(route.path)
    if (seenArtifacts.has(route.artifact)) throw new Error(`Duplicate publication artifact: ${route.artifact}`)
    seenArtifacts.add(route.artifact)
    const artifact = safeArtifact(output, route.artifact)
    if (!await exists(artifact)) throw new Error(`Missing publication artifact: ${route.path} -> ${route.artifact}`)
    if (route.kind === 'page') pageCount += 1
    else if (route.kind === 'resource') resourceCount += 1
    else redirectCount += 1
    if (route.kind !== 'page') continue
    const html = await fs.readFile(artifact, 'utf8')
    if ((html.match(/<title>/gi) ?? []).length !== 1) {
      throw new Error(`Page ${route.path} must contain exactly one title element`)
    }
    const missingAlt = missingAltCount(html)
    if (missingAlt > 0) warnings.push(`${route.path}: ${missingAlt} image(s) missing alt text`)
    if (pageHasIslandRuntime(html) && !/<nib-island\b/i.test(html)) {
      throw new Error(`Static page ${route.path} ships island runtime without an island`)
    }
    for (const href of internalHrefs(html)) {
      checkedLinks += 1
      if (href.startsWith('/assets/') || href.startsWith('/site-assets/') || href.startsWith('/videos/')) continue
      if (!await linkExists(output, manifest, href)) {
        throw new Error(`Broken internal link on ${route.path}: ${href}`)
      }
    }
  }

  return {
    output,
    routeCount: manifest.routes.length,
    pageCount,
    resourceCount,
    redirectCount,
    checkedLinks,
    warnings: Object.freeze(warnings),
  }
}
