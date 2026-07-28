import { validateIslandId } from './island-paths'

export function behaviorFileToId(file: string): string {
  const normalized = file.replaceAll('\\', '/').split(/[?#]/, 1)[0]!
  const marker = '/behaviors/'
  const markerIndex = normalized.lastIndexOf(marker)
  const relative = markerIndex >= 0
    ? normalized.slice(markerIndex + marker.length)
    : normalized.replace(/^\.?\//, '').replace(/^behaviors\//, '')
  const withoutExtension = relative.replace(/\.client\.[cm]?[jt]sx?$/, '')
  if (withoutExtension === relative) {
    throw new Error(`Behavior module must use a .client.ts or .client.tsx suffix: ${file}`)
  }
  return validateIslandId(withoutExtension)
}
