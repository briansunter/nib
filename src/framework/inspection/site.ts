import fs from 'node:fs/promises'
import path from 'node:path'
import {
  parseInspectionDocument,
  type ParsedInspectionDocument,
} from '../html-document'
import type {
  PublicationManifest,
  PublicationManifestRoute,
} from '../publication'
import type {
  ImageProvenanceCandidate,
  ImageProvenanceReport,
  InspectedPage,
  InspectedReference,
  InspectedSiteFile,
  InspectSiteOptions,
  SiteCheckResult,
  SiteInspection,
  SiteInspectionReport,
  SiteIssue,
  SiteVerifierExtension,
  VerifySiteOptions,
} from './contracts'

export * from './contracts'

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
): Promise<InspectedSiteFile[]> {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
    recursive: true,
  })
  const filePaths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort((left, right) => left.localeCompare(right))
  return filePaths.map((file) => Object.freeze({
    path: relativePath(path.relative(directory, file)),
  }))
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

interface DocumentFacts {
  readonly references: readonly InspectedReference[]
  readonly titleCount: number
  readonly imageCount: number
  readonly missingAltCount: number
  readonly hasIslandRuntime: boolean
  readonly islandCount: number
  readonly leakedImageHints: readonly string[]
}

function documentFacts(document: ParsedInspectionDocument): DocumentFacts {
  const pageReferences: InspectedReference[] = []
  const leakedImageHints: string[] = []
  let titleCount = 0
  let imageCount = 0
  let missingAltCount = 0
  let hasIslandRuntime = false
  let islandCount = 0
  for (const element of document.elements) {
    if (element.tagName === 'title') titleCount += 1
    if (element.tagName === 'nib-island') islandCount += 1
    const image = element.tagName === 'img'
    if (image) imageCount += 1
    let hasAlt = false
    let scriptSource = ''
    for (const attribute of element.attrs) {
      if (attribute.name === 'alt') hasAlt = true
      if (element.tagName === 'script' && attribute.name === 'src') {
        scriptSource = attribute.value
      }
      if (attribute.name === 'data-nib-islands') hasIslandRuntime = true
      if (attribute.name === 'data-nib-width' || attribute.name === 'data-nib-widths') {
        leakedImageHints.push(attribute.name)
      }
      if (attribute.name === 'href' || attribute.name === 'src' || attribute.name === 'poster') {
        pageReferences.push(Object.freeze({
          tagName: element.tagName,
          attribute: attribute.name,
          value: attribute.value,
        }))
      } else if (attribute.name === 'srcset') {
        for (const candidate of attribute.value.split(',')) {
          const value = candidate.trim().split(/\s+/, 1)[0]
          if (value) {
            pageReferences.push(Object.freeze({
              tagName: element.tagName,
              attribute: 'srcset',
              value,
            }))
          }
        }
      }
    }
    if (image && !hasAlt) missingAltCount += 1
    if (scriptSource.includes('assets/islands-')) hasIslandRuntime = true
  }
  return Object.freeze({
    references: Object.freeze(pageReferences),
    titleCount,
    imageCount,
    missingAltCount,
    hasIslandRuntime,
    islandCount,
    leakedImageHints: Object.freeze(leakedImageHints),
  })
}

function referencePath(
  value: string,
  route: PublicationManifestRoute,
  base: string,
): string | undefined {
  if (
    !value
    || value.startsWith('#')
    || value.startsWith('//')
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
  ) return undefined
  try {
    const routeSuffix = route.path !== '/' && route.artifact.endsWith('/index.html')
      ? '/'
      : ''
    const routeBase = `http://nib.local${route.path}${routeSuffix}`
    const pathname = value.startsWith('/')
      ? value.split(/[?#]/, 1)[0] || '/'
      : new URL(value, routeBase).pathname
    const normalizedBase = base.startsWith('/') ? base : `/${base}`
    const prefix = normalizedBase.replace(/\/+$/, '')
    const stripped = prefix && (pathname === prefix || pathname === `${prefix}/`)
      ? '/'
      : prefix && pathname.startsWith(`${prefix}/`)
        ? pathname.slice(prefix.length) || '/'
        : pathname
    return decodeURIComponent(stripped)
  } catch {
    return undefined
  }
}

function routeFileCandidates(pathname: string): readonly string[] {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
  if (normalized === '/') return ['index.html']
  const relative = normalized.replace(/^\/+/, '')
  return [relative, `${relative}/index.html`]
}

function referenceExists(
  pathname: string,
  routesByPath: Readonly<Record<string, PublicationManifestRoute>>,
  filesByPath: Readonly<Record<string, InspectedSiteFile>>,
): boolean {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
  const route = routesByPath[normalized]
  if (route) {
    const artifact = safeArtifact(route.artifact)
    return artifact !== undefined && filesByPath[artifact] !== undefined
  }
  return routeFileCandidates(normalized).some((candidate) => filesByPath[candidate] !== undefined)
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
  const pageReads = new Map<PublicationManifestRoute, Promise<string>>()
  for (const route of inspection.routes) {
    const artifact = safeArtifact(route.artifact)
    if (
      route.kind === 'page'
      && artifact !== undefined
      && filesByPath[artifact] !== undefined
    ) {
      pageReads.set(route, fs.readFile(path.join(output, artifact), 'utf8'))
    }
  }
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
      html = await pageReads.get(route)
        ?? await fs.readFile(path.join(output, artifact), 'utf8')
      pageReads.delete(route)
    } catch (error) {
      pageReads.delete(route)
      inspection.issues.push(issue({
        code: 'PAGE_READ_FAILED',
        severity: 'error',
        message: `Could not read page artifact ${artifact} (${errorCode(error)})`,
        route: route.path,
        artifact,
      }))
      continue
    }
    const document = parseInspectionDocument(html)
    const facts = documentFacts(document)
    const page = Object.freeze({
      route,
      document,
      references: facts.references,
      titleCount: facts.titleCount,
      imageCount: facts.imageCount,
      missingAltCount: facts.missingAltCount,
      hasIslandRuntime: facts.hasIslandRuntime,
      islandCount: facts.islandCount,
    })
    inspection.pages.push(page)
    for (const leaked of facts.leakedImageHints) {
      inspection.issues.push(issue({
        code: 'IMAGE_AUTHORING_HINT_LEAKED',
        severity: 'error',
        message: `Image authoring hint ${leaked} leaked into ${route.path}`,
        route: route.path,
        artifact,
      }))
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
    if (facts.titleCount !== 1) {
      inspection.issues.push(issue({
        code: 'TITLE_COUNT',
        severity: 'error',
        message: `Page ${route.path} must contain exactly one title element (found ${facts.titleCount})`,
        route: route.path,
        artifact,
      }))
    }
    if (facts.missingAltCount > 0) {
      inspection.issues.push(issue({
        code: 'IMAGE_ALT_MISSING',
        severity: 'warning',
        message: `${route.path}: ${facts.missingAltCount} image(s) missing alt text`,
        route: route.path,
        artifact,
      }))
    }
    if (facts.hasIslandRuntime && facts.islandCount === 0) {
      inspection.issues.push(issue({
        code: 'ISLAND_RUNTIME_UNUSED',
        severity: 'error',
        message: `Static page ${route.path} ships island runtime without an island`,
        route: route.path,
        artifact,
      }))
    }
    for (const reference of facts.references) {
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
