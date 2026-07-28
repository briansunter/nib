import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const source = path.resolve(
  process.env.PERSONAL_SITE_SRC ?? path.join(root, '../../../personal-site'),
)
const manifest = JSON.parse(await readFile(
  path.join(root, 'src/content/source-provenance.json'),
  'utf8',
))

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

if (manifest.version !== 1 || !Array.isArray(manifest.sharedFiles)) {
  throw new Error('Unsupported personal-site source provenance manifest')
}

for (const entry of manifest.sharedFiles) {
  const replicaFile = path.join(root, entry.path)
  const replicaHash = sha256(await readFile(replicaFile))
  if (replicaHash !== entry.sha256) {
    throw new Error(`Replica shared file drifted from its source contract: ${entry.path}`)
  }
}

if (existsSync(source)) {
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: source,
    encoding: 'utf8',
  }).trim()
  if (sourceCommit !== manifest.sourceCommit) {
    throw new Error(
      `Source snapshot is ${manifest.sourceCommit}, but ${source} is ${sourceCommit}. Run import:content.`,
    )
  }
  for (const entry of manifest.sharedFiles) {
    const sourceHash = sha256(await readFile(path.join(source, entry.path)))
    if (sourceHash !== entry.sha256) {
      throw new Error(`Canonical shared file does not match the frozen checksum: ${entry.path}`)
    }
    if (!existsSync(path.join(source, entry.testOwner))) {
      throw new Error(`Canonical test owner is missing: ${entry.testOwner}`)
    }
  }
}

console.log(
  `Source provenance: ${manifest.sourceCommit.slice(0, 12)}, ${manifest.sharedFiles.length} checksum-backed shared modules.`,
)
