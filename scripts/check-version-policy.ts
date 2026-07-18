import { readFile } from 'node:fs/promises'

interface PackageManifest {
  version?: string
}

const manifest = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
) as PackageManifest

const version = manifest.version ?? ''
if (!/^0\.\d+\.\d+(?:[-+].*)?$/.test(version)) {
  throw new Error(
    `Major releases are disabled for mini-static; expected a 0.x.y version, got ${version || 'missing version'}`,
  )
}

console.log(`Version policy OK: ${version}`)
