import fs from 'node:fs/promises'
import path from 'node:path'

export interface ScaffoldSiteOptions {
  target: string
  packageVersion: string
  templateDirectory: string
}

export interface ScaffoldSiteResult {
  target: string
  created: true
}

export async function scaffoldSite(
  options: ScaffoldSiteOptions,
): Promise<ScaffoldSiteResult> {
  const target = path.resolve(options.target)
  try {
    const entries = await fs.readdir(target)
    if (entries.length > 0) {
      throw new Error(`Target directory is not empty: ${target}`)
    }
  } catch (error) {
    if (
      !(error instanceof Error)
      || !('code' in error)
      || error.code !== 'ENOENT'
    ) {
      throw error
    }
  }

  await fs.cp(options.templateDirectory, target, {
    recursive: true,
    force: false,
  })
  await fs.rename(
    path.join(target, 'gitignore'),
    path.join(target, '.gitignore'),
  )

  const manifestPath = path.join(target, 'package.json')
  const manifest = await fs.readFile(manifestPath, 'utf8')
  const projectName = path.basename(target)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '') || 'nib-site'
  await fs.writeFile(
    manifestPath,
    manifest
      .replaceAll('__NIB_VERSION__', options.packageVersion)
      .replaceAll('__NIB_PROJECT_NAME__', projectName),
  )

  return { target, created: true }
}
