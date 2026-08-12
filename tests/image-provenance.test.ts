import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createPublicationManifest } from '../src/framework/publication'
import { inspectSite, siteInspectionReport } from '../src/framework/verify'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

async function outputFixture(): Promise<string> {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-provenance-'))
  temporaryDirectories.push(output)
  await fs.mkdir(path.join(output, '.nib'), { recursive: true })
  const manifest = createPublicationManifest('/', 'never', [{
    routePath: '/',
    artifact: 'index.html',
    output: {
      kind: 'page',
      page: { status: 200, head: '', html: '', enhancements: [], islands: [] },
    },
  }])
  await fs.writeFile(
    path.join(output, '.nib/publication.json'),
    JSON.stringify(manifest),
  )
  await fs.writeFile(
    path.join(output, 'index.html'),
    '<!doctype html><title>Home</title><img alt="Photo" src="/assets/nib/photo.webp" data-nib-widths="320,640">',
  )
  return output
}

describe('image provenance inspection', () => {
  it('aggregates missing candidates, formats, dimensions, caps, and leaked hints', async () => {
    const output = await outputFixture()
    await fs.writeFile(path.join(output, '.nib/images.json'), JSON.stringify({
      version: 1,
      candidates: [{
        source: 'a'.repeat(24),
        output: 'assets/nib/photo.jpg',
        width: 900,
        height: 1,
        format: 'webp',
        quality: 75,
        passthrough: false,
        sourceWidth: 800,
        sourceHeight: 400,
        sourceFormat: 'jpeg',
        maxWidth: 700,
      }],
    }))

    const inspection = await inspectSite({ root: output, output })
    expect(inspection.issues.map((issue) => issue.code)).toEqual([
      'IMAGE_CANDIDATE_CAP_EXCEEDED',
      'IMAGE_CANDIDATE_DIMENSIONS_INVALID',
      'IMAGE_CANDIDATE_FORMAT_INVALID',
      'IMAGE_CANDIDATE_MISSING',
      'IMAGE_AUTHORING_HINT_LEAKED',
      'LOCAL_REFERENCE_MISSING',
    ])
    expect(inspection.imageProvenance?.candidates).toHaveLength(1)
    expect(JSON.stringify({
      report: siteInspectionReport(inspection),
      provenance: inspection.imageProvenance,
    })).not.toContain(output)
  })

  it('rejects unknown report versions without trusting their candidates', async () => {
    const output = await outputFixture()
    await fs.writeFile(
      path.join(output, '.nib/images.json'),
      JSON.stringify({ version: 42, candidates: [] }),
    )

    const inspection = await inspectSite({ root: output, output })
    expect(inspection.issues.some((issue) => (
      issue.code === 'IMAGE_PROVENANCE_VERSION_UNSUPPORTED'
    ))).toBe(true)
    expect(inspection.imageProvenance).toBeUndefined()
  })
})
