import { readdir, readFile } from 'node:fs/promises'

interface PackageManifest {
  name?: string
  version?: string
}

const packageManifestUrls = [new URL('../package.json', import.meta.url)]
const workspaceDirectory = new URL('../packages/', import.meta.url)

for (const entry of await readdir(workspaceDirectory, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    packageManifestUrls.push(new URL(`../packages/${entry.name}/package.json`, import.meta.url))
  }
}

for (const packageManifestUrl of packageManifestUrls) {
  const manifest = JSON.parse(
    await readFile(packageManifestUrl, 'utf8'),
  ) as PackageManifest
  const version = manifest.version ?? ''
  if (!/^0\.\d+\.\d+(?:[-+].*)?$/.test(version)) {
    throw new Error(
      `Major releases are disabled for ${manifest.name ?? packageManifestUrl.pathname}; expected a 0.x.y version, got ${version || 'missing version'}`,
    )
  }

  console.log(`Version policy OK: ${manifest.name ?? packageManifestUrl.pathname} ${version}`)
}
