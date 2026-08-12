import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPublicationManifest } from '../src/framework/publication'
import {
  SiteVerificationError,
  verifySite,
  type SiteInspection,
} from '../src/framework/verify'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

async function publication(): Promise<string> {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'nib-extension-'))
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
    '<!doctype html><html><head><title>Home</title></head><body><main>Home</main></body></html>',
  )
  return output
}

describe('site verifier extensions', () => {
  it('shares one immutable parsed context and owns extension diagnostics', async () => {
    const output = await publication()
    let received: SiteInspection | undefined
    const verify = vi.fn((inspection: SiteInspection) => {
      received = inspection
      expect(Object.isFrozen(inspection)).toBe(true)
      expect(inspection.pagesByRoute['/']).toBe(inspection.pages[0])
      expect(Object.isFrozen(inspection.pages[0]?.document.elements)).toBe(true)
      return [{
        code: 'SITE_POLICY_MISSING',
        severity: 'error' as const,
        message: 'The home page is missing the site policy marker',
        route: '/',
        owner: 'forged-owner',
      }]
    })

    const failure = await verifySite({
      root: output,
      output,
      extensions: [{ name: 'personal-site-policy', verify }],
    }).catch((error: unknown) => error)

    expect(verify).toHaveBeenCalledOnce()
    expect(received?.metrics.pageCount).toBe(1)
    expect(failure).toBeInstanceOf(SiteVerificationError)
    expect((failure as SiteVerificationError).result.issues).toEqual([{
      code: 'SITE_POLICY_MISSING',
      severity: 'error',
      message: 'The home page is missing the site policy marker',
      route: '/',
      owner: 'personal-site-policy',
    }])
  })

  it('aggregates checker failures without discarding other results', async () => {
    const output = await publication()
    const failure = await verifySite({
      root: output,
      output,
      extensions: [
        {
          name: 'throws',
          verify() {
            throw Object.assign(new Error('private source detail'), { code: 'CHECK_FAILED' })
          },
        },
        {
          name: 'warns',
          verify() {
            return [{
              code: 'SITE_POLICY_WARNING',
              severity: 'warning',
              message: 'Policy warning',
            }]
          },
        },
      ],
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(SiteVerificationError)
    expect((failure as SiteVerificationError).result.issues).toEqual([
      {
        code: 'EXTENSION_FAILED',
        severity: 'error',
        message: 'Verifier extension throws failed (CHECK_FAILED)',
        owner: 'throws',
      },
      {
        code: 'SITE_POLICY_WARNING',
        severity: 'warning',
        message: 'Policy warning',
        owner: 'warns',
      },
    ])
  })

  it('reports malformed optional issue fields as an invalid extension result', async () => {
    const output = await publication()
    const failure = await verifySite({
      root: output,
      output,
      extensions: [{
        name: 'malformed',
        verify: () => [{
          code: 'BAD_FIELD',
          severity: 'error',
          message: 'Bad field',
          route: 42,
        } as never],
      }],
    }).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(SiteVerificationError)
    expect((failure as SiteVerificationError).result.issues).toContainEqual({
      code: 'EXTENSION_RESULT_INVALID',
      severity: 'error',
      message: 'Verifier extension malformed returned invalid issues',
      owner: 'malformed',
    })
  })
})
