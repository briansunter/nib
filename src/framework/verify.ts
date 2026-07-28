import fs from 'node:fs/promises'
import path from 'node:path'
import {
  htmlAttribute,
  parseHtmlDocument,
  type ParsedHtmlDocument,
} from './html-document'
import type {
  PublicationManifest,
  PublicationManifestRoute,
} from './publication'
import { normalizePath, stripBasePath } from './publication'

export type SiteIssueSeverity = 'error' | 'warning'

export interface SiteIssue {
  readonly code: string
  readonly severity: SiteIssueSeverity
  readonly message: string
  readonly route?: string
  readonly artifact?: string
  readonly reference?: string
  readonly owner?: string
}

export interface InspectedSiteFile {
  readonly path: string
  readonly size: number
}

export interface InspectedReference {
  readonly tagName: string
  readonly attribute: 'href' | 'src' | 'srcset' | 'poster'
  readonly value: string
}

export interface InspectedPage {
  readonly route: PublicationManifestRoute
  readonly document: ParsedHtmlDocument
  readonly references: readonly InspectedReference[]
  readonly titleCount: number
  readonly imageCount: number
  readonly missingAltCount: number
  readonly hasIslandRuntime: boolean
  readonly islandCount: number
}

export interface SiteInspectionMetrics {
  readonly routeCount: number
  readonly pageCount: number
  readonly resourceCount: number
  readonly redirectCount: number
  readonly fileCount: number
  readonly checkedReferences: number
}

export interface ImageProvenanceCandidate {
  readonly source: string
  readonly output: string
  readonly width: number
  readonly height: number
  readonly format: 'avif' | 'webp' | 'jpeg' | 'png' | 'gif' | 'svg'
  readonly quality: number
  readonly passthrough: boolean
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly sourceFormat: 'avif' | 'webp' | 'jpeg' | 'png' | 'gif' | 'svg'
  readonly maxWidth: number
}

export interface ImageProvenanceReport {
  readonly version: 1
  readonly candidates: readonly ImageProvenanceCandidate[]
}

export interface SiteInspection {
  readonly version: 1
  /** Root-relative output directory. Never an absolute authoring path. */
  readonly output: string
  readonly manifest?: PublicationManifest
  readonly routes: readonly PublicationManifestRoute[]
  readonly routesByPath: Readonly<Record<string, PublicationManifestRoute>>
  readonly files: readonly InspectedSiteFile[]
  readonly filesByPath: Readonly<Record<string, InspectedSiteFile>>
  readonly pages: readonly InspectedPage[]
  readonly pagesByRoute: Readonly<Record<string, InspectedPage>>
  readonly imageProvenance?: ImageProvenanceReport
  readonly metrics: SiteInspectionMetrics
  readonly issues: readonly SiteIssue[]
}

export interface SiteInspectionReport {
  readonly version: 1
  readonly output: string
  readonly metrics: SiteInspectionMetrics
  readonly issues: readonly SiteIssue[]
}

export interface SiteCheckResult extends SiteInspectionReport {
  readonly ok: boolean
  readonly routeCount: number
  readonly pageCount: number
  readonly resourceCount: number
  readonly redirectCount: number
  readonly checkedLinks: number
  readonly warnings: readonly string[]
}

export interface InspectSiteOptions {
  readonly root: string
  readonly output?: string
}

export interface SiteVerifierExtension {
  /** Stable diagnostic owner included on every issue from this checker. */
  readonly name: string
  /** Read-only verification over the already indexed and parsed publication. */
  readonly verify: (
    inspection: SiteInspection,
  ) => readonly SiteIssue[] | Promise<readonly SiteIssue[]>
}

export interface VerifySiteOptions extends InspectSiteOptions {
  readonly extensions?: readonly SiteVerifierExtension[]
}

export class SiteVerificationError extends Error {
  readonly result: SiteCheckResult

  constructor(result: SiteCheckResult) {
    const errors = result.issues.filter((issue) => issue.severity === 'error')
    super(`Site verification failed with ${errors.length} error(s)\n${errors.map(formatSiteIssue).join('\n')}`)
    this.name = 'SiteVerificationError'
    this.result = result
  }
}

interface MutableInspection {
  manifest?: PublicationManifest
  routes: PublicationManifestRoute[]
  files: InspectedSiteFile[]
  pages: InspectedPage[]
  issues: SiteIssue[]
  checkedReferences: number
  imageProvenance?: ImageProvenanceReport
}

const MANIFEST_PATH = '.nib/publication.json'
const IMAGE_PROVENANCE_PATH = '.nib/images.json'
const IMAGE_FORMATS = new Set(['avif', 'webp', 'jpeg', 'png', 'gif', 'svg'])

function record<T extends { readonly path: string }>(
  values: readonly T[],
): Readonly<Record<string, T>> {
  const result: Record<string, T> = Object.create(null) as Record<string, T>
  for (const value of values) result[value.path] ??= value
  return Object.freeze(result)
}

function pageRecord(
  values: readonly InspectedPage[],
): Readonly<Record<string, InspectedPage>> {
  const result: Record<string, InspectedPage> = Object.create(null) as Record<string, InspectedPage>
  for (const value of values) result[value.route.path] ??= value
  return Object.freeze(result)
}

function issue(input: SiteIssue): SiteIssue {
  return Object.freeze(input)
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return 'UNKNOWN'
}

function relativePath(value: string): string {
  return value.split(path.sep).join('/')
}

async function indexFiles(
  directory: string,
  relative = '',
): Promise<InspectedSiteFile[]> {
  const entries = await fs.readdir(path.join(directory, relative), {
    withFileTypes: true,
  })
  const files: InspectedSiteFile[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.join(relative, entry.name)
    if (entry.isDirectory()) {
      files.push(...await indexFiles(directory, child))
    } else if (entry.isFile()) {
      const stats = await fs.stat(path.join(directory, child))
      files.push(Object.freeze({ path: relativePath(child), size: stats.size }))
    }
  }
  return files
}

function isManifest(value: unknown): value is PublicationManifest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PublicationManifest>
  return candidate.version === 1
    && typeof candidate.base === 'string'
    && Array.isArray(candidate.routes)
    && candidate.routes.every((route) => {
      if (!route || typeof route !== 'object') return false
      const item = route as Partial<PublicationManifestRoute>
      return (item.kind === 'page' || item.kind === 'resource' || item.kind === 'redirect')
        && typeof item.path === 'string'
        && typeof item.artifact === 'string'
        && typeof item.status === 'number'
        && typeof item.contentType === 'string'
    })
}

function isImageProvenanceCandidate(value: unknown): value is ImageProvenanceCandidate {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ImageProvenanceCandidate>
  return typeof candidate.source === 'string'
    && typeof candidate.output === 'string'
    && typeof candidate.width === 'number'
    && typeof candidate.height === 'number'
    && typeof candidate.format === 'string'
    && typeof candidate.quality === 'number'
    && typeof candidate.passthrough === 'boolean'
    && typeof candidate.sourceWidth === 'number'
    && typeof candidate.sourceHeight === 'number'
    && typeof candidate.sourceFormat === 'string'
    && typeof candidate.maxWidth === 'number'
}

async function inspectImageProvenance(
  output: string,
  inspection: MutableInspection,
): Promise<void> {
  const filesByPath = record(inspection.files)
  if (filesByPath[IMAGE_PROVENANCE_PATH] === undefined) return
  let parsed: unknown
  try {
    parsed = JSON.parse(await fs.readFile(path.join(output, IMAGE_PROVENANCE_PATH), 'utf8'))
  } catch (error) {
    inspection.issues.push(issue({
      code: 'IMAGE_PROVENANCE_INVALID',
      severity: 'error',
      message: `Could not parse ${IMAGE_PROVENANCE_PATH} (${errorCode(error)})`,
      artifact: IMAGE_PROVENANCE_PATH,
    }))
    return
  }
  if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) {
    inspection.issues.push(issue({
      code: 'IMAGE_PROVENANCE_VERSION_UNSUPPORTED',
      severity: 'error',
      message: `Unsupported image provenance report version in ${IMAGE_PROVENANCE_PATH}`,
      artifact: IMAGE_PROVENANCE_PATH,
    }))
    return
  }
  const candidates = (parsed as { candidates?: unknown }).candidates
  if (
    !Array.isArray(candidates)
    || candidates.some((candidate) => !isImageProvenanceCandidate(candidate))
  ) {
    inspection.issues.push(issue({
      code: 'IMAGE_PROVENANCE_INVALID',
      severity: 'error',
      message: `Invalid image provenance report: ${IMAGE_PROVENANCE_PATH}`,
      artifact: IMAGE_PROVENANCE_PATH,
    }))
    return
  }
  const frozenCandidates = Object.freeze(
    candidates.map((candidate) => Object.freeze(candidate)),
  )
  inspection.imageProvenance = Object.freeze({
    version: 1,
    candidates: frozenCandidates,
  })
  const seenOutputs = new Set<string>()
  for (const candidate of frozenCandidates) {
    const artifact = safeArtifact(candidate.output)
    if (artifact === undefined) {
      inspection.issues.push(issue({
        code: 'IMAGE_CANDIDATE_PATH_ESCAPE',
        severity: 'error',
        message: `Image candidate escapes output directory: ${candidate.output}`,
        artifact: candidate.output,
      }))
      continue
    }
    if (seenOutputs.has(artifact)) {
      inspection.issues.push(issue({
        code: 'IMAGE_CANDIDATE_DUPLICATE',
        severity: 'error',
        message: `Duplicate image provenance candidate: ${artifact}`,
        artifact,
      }))
    }
    seenOutputs.add(artifact)
    if (filesByPath[artifact] === undefined) {
      inspection.issues.push(issue({
        code: 'IMAGE_CANDIDATE_MISSING',
        severity: 'error',
        message: `Missing image candidate: ${artifact}`,
        artifact,
      }))
    }
    const extension = path.posix.extname(artifact).slice(1).toLowerCase()
    if (!IMAGE_FORMATS.has(candidate.format) || extension !== candidate.format) {
      inspection.issues.push(issue({
        code: 'IMAGE_CANDIDATE_FORMAT_INVALID',
        severity: 'error',
        message: `Image candidate format does not match its output: ${artifact}`,
        artifact,
      }))
    }
    const dimensions = [
      candidate.width,
      candidate.height,
      candidate.sourceWidth,
      candidate.sourceHeight,
      candidate.maxWidth,
    ]
    const expectedHeight = Math.max(
      1,
      Math.round(candidate.sourceHeight * candidate.width / candidate.sourceWidth),
    )
    if (
      dimensions.some((value) => !Number.isSafeInteger(value) || value <= 0)
      || Math.abs(candidate.height - expectedHeight) > 1
    ) {
      inspection.issues.push(issue({
        code: 'IMAGE_CANDIDATE_DIMENSIONS_INVALID',
        severity: 'error',
        message: `Invalid image candidate dimensions: ${artifact}`,
        artifact,
      }))
    }
    if (candidate.width > candidate.maxWidth || candidate.maxWidth > candidate.sourceWidth) {
      inspection.issues.push(issue({
        code: 'IMAGE_CANDIDATE_CAP_EXCEEDED',
        severity: 'error',
        message: `Image candidate exceeds its recorded width cap: ${artifact}`,
        artifact,
      }))
    }
    if (
      !Number.isSafeInteger(candidate.quality)
      || candidate.quality < 1
      || candidate.quality > 100
      || !/^[a-f0-9]{24}$/.test(candidate.source)
      || !IMAGE_FORMATS.has(candidate.sourceFormat)
    ) {
      inspection.issues.push(issue({
        code: 'IMAGE_CANDIDATE_METADATA_INVALID',
        severity: 'error',
        message: `Invalid image candidate metadata: ${artifact}`,
        artifact,
      }))
    }
  }
}

async function readManifest(
  output: string,
  inspection: MutableInspection,
): Promise<void> {
  try {
    const parsed: unknown = JSON.parse(
      await fs.readFile(path.join(output, MANIFEST_PATH), 'utf8'),
    )
    if (!isManifest(parsed)) {
      inspection.issues.push(issue({
        code: 'MANIFEST_INVALID',
        severity: 'error',
        message: `Invalid or unsupported Nib publication manifest: ${MANIFEST_PATH}`,
        artifact: MANIFEST_PATH,
      }))
      return
    }
    const routes = Object.freeze(parsed.routes.map((route) => Object.freeze(route)))
    inspection.manifest = Object.freeze({ ...parsed, routes })
    inspection.routes.push(...routes)
  } catch (error) {
    inspection.issues.push(issue({
      code: 'MANIFEST_READ_FAILED',
      severity: 'error',
      message: `Could not read ${MANIFEST_PATH} (${errorCode(error)})`,
      artifact: MANIFEST_PATH,
    }))
  }
}

function safeArtifact(artifact: string): string | undefined {
  const normalized = path.posix.normalize(artifact.replaceAll('\\', '/'))
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    return undefined
  }
  return normalized
}

function references(document: ParsedHtmlDocument): readonly InspectedReference[] {
  const result: InspectedReference[] = []
  for (const element of document.elements) {
    for (const attribute of ['href', 'src', 'poster'] as const) {
      const value = htmlAttribute(element, attribute)
      if (value !== undefined) {
        result.push(Object.freeze({ tagName: element.tagName, attribute, value }))
      }
    }
    const srcset = htmlAttribute(element, 'srcset')
    if (srcset !== undefined) {
      for (const candidate of srcset.split(',')) {
        const value = candidate.trim().split(/\s+/, 1)[0]
        if (value) {
          result.push(Object.freeze({
            tagName: element.tagName,
            attribute: 'srcset',
            value,
          }))
        }
      }
    }
  }
  return Object.freeze(result)
}

function isLocalReference(value: string): boolean {
  if (!value || value.startsWith('#') || value.startsWith('//')) return false
  try {
    const parsed = new URL(value, 'http://nib.local')
    return parsed.origin === 'http://nib.local'
      && !/^(?:data|mailto|tel|javascript):/i.test(value)
  } catch {
    return false
  }
}

function referencePath(
  value: string,
  route: PublicationManifestRoute,
  base: string,
): string | undefined {
  if (!isLocalReference(value)) return undefined
  try {
    const routeSuffix = route.path !== '/' && route.artifact.endsWith('/index.html')
      ? '/'
      : ''
    const routeBase = `http://nib.local${route.path}${routeSuffix}`
    const pathname = new URL(value, routeBase).pathname
    return decodeURIComponent(stripBasePath(pathname, base).split(/[?#]/, 1)[0] || '/')
  } catch {
    return undefined
  }
}

function routeFileCandidates(pathname: string): readonly string[] {
  const normalized = normalizePath(pathname)
  if (normalized === '/') return ['index.html']
  const relative = normalized.replace(/^\/+/, '')
  return [relative, `${relative}/index.html`]
}

function referenceExists(
  pathname: string,
  routesByPath: Readonly<Record<string, PublicationManifestRoute>>,
  filesByPath: Readonly<Record<string, InspectedSiteFile>>,
): boolean {
  const route = routesByPath[normalizePath(pathname)]
  if (route) {
    const artifact = safeArtifact(route.artifact)
    return artifact !== undefined && filesByPath[artifact] !== undefined
  }
  return routeFileCandidates(pathname).some((candidate) => filesByPath[candidate] !== undefined)
}

function inspectRouteIndexes(inspection: MutableInspection): void {
  const seenPaths = new Set<string>()
  const seenArtifacts = new Set<string>()
  for (const route of inspection.routes) {
    if (seenPaths.has(route.path)) {
      inspection.issues.push(issue({
        code: 'DUPLICATE_ROUTE',
        severity: 'error',
        message: `Duplicate publication route: ${route.path}`,
        route: route.path,
      }))
    }
    seenPaths.add(route.path)
    if (seenArtifacts.has(route.artifact)) {
      inspection.issues.push(issue({
        code: 'DUPLICATE_ARTIFACT',
        severity: 'error',
        message: `Duplicate publication artifact: ${route.artifact}`,
        route: route.path,
        artifact: route.artifact,
      }))
    }
    seenArtifacts.add(route.artifact)
  }
}

async function inspectPages(
  output: string,
  inspection: MutableInspection,
): Promise<void> {
  const filesByPath = record(inspection.files)
  const routesByPath = record(inspection.routes)
  for (const route of inspection.routes) {
    const artifact = safeArtifact(route.artifact)
    if (artifact === undefined) {
      inspection.issues.push(issue({
        code: 'ARTIFACT_PATH_ESCAPE',
        severity: 'error',
        message: `Publication artifact escapes output directory: ${route.artifact}`,
        route: route.path,
        artifact: route.artifact,
      }))
      continue
    }
    if (filesByPath[artifact] === undefined) {
      inspection.issues.push(issue({
        code: 'ARTIFACT_MISSING',
        severity: 'error',
        message: `Missing publication artifact: ${route.path} -> ${artifact}`,
        route: route.path,
        artifact,
      }))
      continue
    }
    if (route.kind !== 'page') continue
    let html: string
    try {
      html = await fs.readFile(path.join(output, artifact), 'utf8')
    } catch (error) {
      inspection.issues.push(issue({
        code: 'PAGE_READ_FAILED',
        severity: 'error',
        message: `Could not read page artifact ${artifact} (${errorCode(error)})`,
        route: route.path,
        artifact,
      }))
      continue
    }
    const document = parseHtmlDocument(html)
    const pageReferences = references(document)
    const titles = document.elements.filter((element) => element.tagName === 'title')
    const images = document.elements.filter((element) => element.tagName === 'img')
    const islandCount = document.elements.filter((element) => element.tagName === 'nib-island').length
    const hasIslandRuntime = document.elements.some((element) =>
      htmlAttribute(element, 'data-nib-islands') !== undefined
      || (element.tagName === 'script' && (htmlAttribute(element, 'src') ?? '').includes('assets/islands-')),
    )
    const missingAltCount = images.filter((element) => htmlAttribute(element, 'alt') === undefined).length
    const page = Object.freeze({
      route,
      document,
      references: pageReferences,
      titleCount: titles.length,
      imageCount: images.length,
      missingAltCount,
      hasIslandRuntime,
      islandCount,
    })
    inspection.pages.push(page)
    for (const element of document.elements) {
      const leaked = element.attrs.find((attribute) => (
        attribute.name === 'data-nib-width' || attribute.name === 'data-nib-widths'
      ))
      if (leaked) {
        inspection.issues.push(issue({
          code: 'IMAGE_AUTHORING_HINT_LEAKED',
          severity: 'error',
          message: `Image authoring hint ${leaked.name} leaked into ${route.path}`,
          route: route.path,
          artifact,
        }))
      }
    }
    for (const parseError of document.parseErrors) {
      if (parseError.code === 'missing-doctype') continue
      inspection.issues.push(issue({
        code: 'HTML_PARSE_ERROR',
        severity: 'error',
        message: `Malformed HTML on ${route.path}: ${parseError.code} at ${parseError.startLine}:${parseError.startCol}`,
        route: route.path,
        artifact,
      }))
    }
    if (titles.length !== 1) {
      inspection.issues.push(issue({
        code: 'TITLE_COUNT',
        severity: 'error',
        message: `Page ${route.path} must contain exactly one title element (found ${titles.length})`,
        route: route.path,
        artifact,
      }))
    }
    if (missingAltCount > 0) {
      inspection.issues.push(issue({
        code: 'IMAGE_ALT_MISSING',
        severity: 'warning',
        message: `${route.path}: ${missingAltCount} image(s) missing alt text`,
        route: route.path,
        artifact,
      }))
    }
    if (hasIslandRuntime && islandCount === 0) {
      inspection.issues.push(issue({
        code: 'ISLAND_RUNTIME_UNUSED',
        severity: 'error',
        message: `Static page ${route.path} ships island runtime without an island`,
        route: route.path,
        artifact,
      }))
    }
    for (const reference of pageReferences) {
      const pathname = referencePath(reference.value, route, inspection.manifest?.base ?? '/')
      if (pathname === undefined) continue
      inspection.checkedReferences += 1
      if (!referenceExists(pathname, routesByPath, filesByPath)) {
        inspection.issues.push(issue({
          code: 'LOCAL_REFERENCE_MISSING',
          severity: 'error',
          message: `Missing local ${reference.attribute} on ${route.path}: ${reference.value}`,
          route: route.path,
          artifact,
          reference: reference.value,
        }))
      }
    }
  }
}

function issueOrder(left: SiteIssue, right: SiteIssue): number {
  return (left.route ?? '').localeCompare(right.route ?? '')
    || left.code.localeCompare(right.code)
    || (left.owner ?? '').localeCompare(right.owner ?? '')
    || (left.reference ?? '').localeCompare(right.reference ?? '')
    || left.message.localeCompare(right.message)
}

function isSiteIssue(value: unknown): value is SiteIssue {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SiteIssue>
  return typeof candidate.code === 'string'
    && (candidate.severity === 'error' || candidate.severity === 'warning')
    && typeof candidate.message === 'string'
}

async function extensionIssues(
  inspection: SiteInspection,
  extensions: readonly SiteVerifierExtension[],
): Promise<readonly SiteIssue[]> {
  const groups = await Promise.all(extensions.map(async (extension): Promise<readonly SiteIssue[]> => {
    if (!extension.name.trim()) {
      return [issue({
        code: 'EXTENSION_NAME_INVALID',
        severity: 'error',
        message: 'A site verifier extension has an empty name',
        owner: 'nib',
      })]
    }
    try {
      const values = await extension.verify(inspection)
      if (!Array.isArray(values) || values.some((value) => !isSiteIssue(value))) {
        return [issue({
          code: 'EXTENSION_RESULT_INVALID',
          severity: 'error',
          message: `Verifier extension ${extension.name} returned invalid issues`,
          owner: extension.name,
        })]
      }
      return values.map((value) => issue({
        ...value,
        owner: extension.name,
      }))
    } catch (error) {
      return [issue({
        code: 'EXTENSION_FAILED',
        severity: 'error',
        message: `Verifier extension ${extension.name} failed (${errorCode(error)})`,
        owner: extension.name,
      })]
    }
  }))
  return Object.freeze(groups.flat().sort(issueOrder))
}

/** Indexes and parses a static publication once, returning all built-in issues. */
export async function inspectSite(options: InspectSiteOptions): Promise<SiteInspection> {
  const root = path.resolve(options.root)
  const output = path.resolve(options.output ?? path.join(root, 'dist/client'))
  const inspection: MutableInspection = {
    routes: [],
    files: [],
    pages: [],
    issues: [],
    checkedReferences: 0,
  }
  try {
    inspection.files.push(...await indexFiles(output))
  } catch (error) {
    inspection.issues.push(issue({
      code: 'FILE_INDEX_FAILED',
      severity: 'error',
      message: `Could not index publication output (${errorCode(error)})`,
    }))
  }
  await readManifest(output, inspection)
  inspectRouteIndexes(inspection)
  if (inspection.manifest) await inspectPages(output, inspection)
  await inspectImageProvenance(output, inspection)
  inspection.issues.sort(issueOrder)

  const pageCount = inspection.routes.filter((route) => route.kind === 'page').length
  const resourceCount = inspection.routes.filter((route) => route.kind === 'resource').length
  const redirectCount = inspection.routes.filter((route) => route.kind === 'redirect').length
  const metrics = Object.freeze({
    routeCount: inspection.routes.length,
    pageCount,
    resourceCount,
    redirectCount,
    fileCount: inspection.files.length,
    checkedReferences: inspection.checkedReferences,
  })
  const routes = Object.freeze(inspection.routes.map((route) => Object.freeze(route)))
  const files = Object.freeze(inspection.files)
  const pages = Object.freeze(inspection.pages)
  return Object.freeze({
    version: 1,
    output: relativePath(path.relative(root, output) || '.'),
    ...(inspection.manifest === undefined ? {} : { manifest: Object.freeze(inspection.manifest) }),
    routes,
    routesByPath: record(routes),
    files,
    filesByPath: record(files),
    pages,
    pagesByRoute: pageRecord(pages),
    ...(inspection.imageProvenance === undefined
      ? {}
      : { imageProvenance: inspection.imageProvenance }),
    metrics,
    issues: Object.freeze(inspection.issues),
  })
}

export function siteInspectionReport(inspection: SiteInspection): SiteInspectionReport {
  return Object.freeze({
    version: inspection.version,
    output: inspection.output,
    metrics: inspection.metrics,
    issues: inspection.issues,
  })
}

export function formatSiteIssue(value: SiteIssue): string {
  const location = value.route ?? value.artifact
  return `${value.severity.toUpperCase()} ${value.code}${location ? ` [${location}]` : ''}: ${value.message}`
}

/** Verifies a publication and throws one aggregate error after every check runs. */
export async function verifySite(options: VerifySiteOptions): Promise<SiteCheckResult> {
  const inspection = await inspectSite(options)
  const ownedIssues = await extensionIssues(inspection, options.extensions ?? [])
  const issues = Object.freeze([...inspection.issues, ...ownedIssues].sort(issueOrder))
  const report = {
    ...siteInspectionReport(inspection),
    issues,
  }
  const warnings = issues
    .filter((value) => value.severity === 'warning')
    .map((value) => value.message)
  const result = Object.freeze({
    ...report,
    ok: !issues.some((value) => value.severity === 'error'),
    routeCount: inspection.metrics.routeCount,
    pageCount: inspection.metrics.pageCount,
    resourceCount: inspection.metrics.resourceCount,
    redirectCount: inspection.metrics.redirectCount,
    checkedLinks: inspection.metrics.checkedReferences,
    warnings: Object.freeze(warnings),
  })
  if (!result.ok) throw new SiteVerificationError(result)
  return result
}
