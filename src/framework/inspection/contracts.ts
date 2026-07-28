import type { ParsedInspectionDocument } from '../html-document'
import type {
  PublicationManifest,
  PublicationManifestRoute,
} from '../publication'

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
}

export interface InspectedReference {
  readonly tagName: string
  readonly attribute: 'href' | 'src' | 'srcset' | 'poster'
  readonly value: string
}

export interface InspectedPage {
  readonly route: PublicationManifestRoute
  readonly document: ParsedInspectionDocument
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
  readonly name: string
  readonly verify: (
    inspection: SiteInspection,
  ) => readonly SiteIssue[] | Promise<readonly SiteIssue[]>
}

export interface VerifySiteOptions extends InspectSiteOptions {
  readonly extensions?: readonly SiteVerifierExtension[]
}
