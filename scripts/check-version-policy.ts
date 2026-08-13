import { readdir, readFile } from 'node:fs/promises'
import { parse } from 'yaml'

interface PackageManifest {
  name?: string
  version?: string
}

interface WorkflowStep {
  name?: string
  uses?: string
  if?: string
  run?: string
  with?: Record<string, unknown>
}

interface ReleaseWorkflow {
  on?: {
    workflow_dispatch?: {
      inputs?: Record<string, Record<string, unknown>>
    }
  }
  jobs?: {
    publish?: {
      concurrency?: {
        group?: string
        'cancel-in-progress'?: boolean
      }
      if?: string
      permissions?: Record<string, unknown>
      steps?: WorkflowStep[]
    }
  }
}

function assertPolicy(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const packageManifests = [
  { packagePath: '.', url: new URL('../package.json', import.meta.url) },
]
const workspaceDirectory = new URL('../packages/', import.meta.url)

for (const entry of await readdir(workspaceDirectory, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    packageManifests.push({
      packagePath: `packages/${entry.name}`,
      url: new URL(`../packages/${entry.name}/package.json`, import.meta.url),
    })
  }
}

for (const { url: packageManifestUrl } of packageManifests) {
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

const releaseManifest = JSON.parse(
  await readFile(new URL('../.release-please-manifest.json', import.meta.url), 'utf8'),
) as Record<string, string>

const expectedReleasePaths = packageManifests
  .map(({ packagePath }) => packagePath)
  .sort()
const actualReleasePaths = Object.keys(releaseManifest).sort()

assertPolicy(
  JSON.stringify(actualReleasePaths) === JSON.stringify(expectedReleasePaths),
  `Release Please manifest package paths must exactly match package manifests; expected ${expectedReleasePaths.join(', ')}, got ${actualReleasePaths.join(', ')}`,
)

for (const [packagePath, releaseVersion] of Object.entries(releaseManifest)) {
  const packageManifestUrl = new URL(
    packagePath === '.' ? '../package.json' : `../${packagePath}/package.json`,
    import.meta.url,
  )
  const packageManifest = JSON.parse(
    await readFile(packageManifestUrl, 'utf8'),
  ) as PackageManifest

  assertPolicy(
    packageManifest.version === releaseVersion,
    `Release Please manifest version ${releaseVersion} does not match ${packageManifest.name ?? packagePath} package version ${packageManifest.version ?? 'missing'}`,
  )
}

const releaseWorkflow = parse(
  await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'),
) as ReleaseWorkflow
const dispatchInputs = releaseWorkflow.on?.workflow_dispatch?.inputs ?? {}
const releasePackageInput = dispatchInputs.release_package

assertPolicy(
  releasePackageInput?.type === 'choice' &&
    Array.isArray(releasePackageInput.options) &&
    releasePackageInput.options.join(',') === 'nib,nib-images',
  'Manual releases must select exactly one supported package',
)
assertPolicy(
  dispatchInputs.release_tag?.type === 'string' &&
    dispatchInputs.release_tag.required === true,
  'Manual releases must require an exact release_tag',
)
assertPolicy(
  !('release_ref' in dispatchInputs) &&
    !('publish_root' in dispatchInputs) &&
    !('publish_images' in dispatchInputs),
  'Manual releases must not accept arbitrary refs or independent publish booleans',
)

const publishJob = releaseWorkflow.jobs?.publish
assertPolicy(publishJob, 'Release workflow must define the publish job')
assertPolicy(
  publishJob.if?.includes("github.ref == 'refs/heads/master'"),
  'Manual publication must only run from the master workflow ref',
)
assertPolicy(
  publishJob.concurrency?.group === 'npm-publish' &&
    publishJob.concurrency['cancel-in-progress'] === false,
  'npm publication jobs must share a non-cancelling concurrency group',
)
assertPolicy(
  publishJob.permissions?.contents === 'read' &&
    publishJob.permissions?.['id-token'] === 'write' &&
    Object.keys(publishJob.permissions).length === 2,
  'Publish job permissions must be limited to contents: read and id-token: write',
)

const publishSteps = publishJob.steps ?? []
const checkoutStep = publishSteps.find((step) =>
  step.uses?.startsWith('actions/checkout@'),
)
assertPolicy(
  checkoutStep?.with?.['persist-credentials'] === false &&
    checkoutStep.with['fetch-depth'] === 0 &&
    checkoutStep.with['fetch-tags'] === true,
  'Release checkout must fetch tag history without persisting credentials',
)

const validationStep = publishSteps.find(
  (step) => step.name === 'Verify release tag and version',
)
const validationIndex = publishSteps.indexOf(validationStep ?? {})
const installIndex = publishSteps.findIndex(
  (step) => step.name === 'Install dependencies',
)
const validationScript = validationStep?.run ?? ''

assertPolicy(
  validationIndex >= 0 && installIndex > validationIndex,
  'Release identity must be verified before dependencies are installed',
)
for (const requiredCheck of [
  'git merge-base --is-ancestor',
  'refs/remotes/origin/master',
  'gh release view',
  '--json isDraft,isPrerelease',
  'select(.isDraft == false and .isPrerelease == false)',
  '.release-please-manifest.json',
  'package_version" != "$manifest_version',
  'package_version" =~ ^0\\.[0-9]+\\.[0-9]+$',
  'release_tag" != "$expected_tag',
  'tag_commit" != "$head_commit',
  'npm view "${package_name}@${package_version}" version',
  'published_result" != *"E404"*',
  'npm view "${package_name}@latest" version',
  'must be newer than current latest',
]) {
  assertPolicy(
    validationScript.includes(requiredCheck),
    `Release validation is missing required check: ${requiredCheck}`,
  )
}

const installStep = publishSteps[installIndex]
assertPolicy(
  installStep?.run?.includes('bun install --frozen-lockfile --ignore-scripts'),
  'Release dependency installation must be frozen and ignore lifecycle scripts',
)

const npmInstallStep = publishSteps.find(
  (step) => step.name === 'Update npm for trusted publishing',
)
assertPolicy(
  npmInstallStep?.run?.includes('--ignore-scripts'),
  'Trusted-publishing npm installation must ignore lifecycle scripts',
)

const npmPublishSteps = publishSteps.filter((step) =>
  step.run?.includes('npm publish --provenance'),
)
assertPolicy(
  npmPublishSteps.length === 2 &&
    npmPublishSteps.every((step) => step.run?.includes('--ignore-scripts')),
  'Both package publication steps must ignore lifecycle scripts',
)

for (const publishStep of npmPublishSteps) {
  const publishIndex = publishSteps.indexOf(publishStep)
  const recheckStep = publishSteps[publishIndex - 1]
  const recheckScript = recheckStep?.run ?? ''
  assertPolicy(
      recheckStep?.name?.startsWith('Recheck @briansunter/') &&
      recheckScript.includes('npm view "${PACKAGE_NAME}@${package_version}" version') &&
      recheckScript.includes('published_result" != *"E404"*') &&
      recheckScript.includes('npm view "${PACKAGE_NAME}@latest" version') &&
      recheckScript.includes('candidate[index] <= latest[index]'),
    `npm ordering must be rechecked immediately before ${publishStep.name ?? 'publication'}`,
  )
}

console.log('Release workflow policy OK')
