import { validateIslandId } from './island-paths'

export const BEHAVIOR_MODULE_GLOB =
  '/src/behaviors/**/*.client.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'

export function behaviorFileToId(file: string): string {
  const normalized = file.replaceAll('\\', '/').split(/[?#]/, 1)[0]!
  const marker = '/behaviors/'
  const markerIndex = normalized.lastIndexOf(marker)
  const relative = markerIndex >= 0
    ? normalized.slice(markerIndex + marker.length)
    : normalized.replace(/^\.?\//, '').replace(/^behaviors\//, '')
  const withoutExtension = relative.replace(
    /\.client\.(?:[cm]?[jt]s|[jt]sx)$/,
    '',
  )
  if (withoutExtension === relative) {
    throw new Error(
      `Behavior module must use a .client JavaScript or TypeScript filename: ${file}`,
    )
  }
  return validateIslandId(withoutExtension)
}
