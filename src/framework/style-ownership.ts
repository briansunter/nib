import path from 'node:path'
import type { Plugin } from 'vite'
import type { NibViteTarget } from './plugin'

const CSS_IMPORT = /\b(?:import|export)\s+(?:[^'"]*?\sfrom\s*)?['"]([^'"]+\.css(?:\?[^'"]*)?)['"]/g
const DYNAMIC_CSS_IMPORT = /\bimport\s*\(\s*['"]([^'"]+\.css(?:\?[^'"]*)?)['"]\s*\)/g

function cleanId(id: string): string {
  return id.replace(/[?#].*$/, '').replaceAll('\\', '/')
}

function applicationModule(root: string, id: string): boolean {
  const sourceRoot = `${path.resolve(root, 'src').replaceAll('\\', '/')}/`
  const file = cleanId(id)
  return file.startsWith(sourceRoot)
    && !file.includes('/src/islands/')
    && !file.includes('/src/behaviors/')
    && file !== `${sourceRoot}style.css`
    && !file.endsWith('.client.ts')
    && !file.endsWith('.client.tsx')
}

function cssImports(code: string): string[] {
  return [...new Set(
    [...code.matchAll(CSS_IMPORT), ...code.matchAll(DYNAMIC_CSS_IMPORT)]
      .map((match) => match[1]!),
  )]
}

/**
 * Rejects styles that the server can see but Nib's deployed client entries
 * cannot. Route-scoped CSS is deliberately not inferred in this contract.
 */
export function pageStyleOwnershipGuard(
  root: string,
  target: NibViteTarget,
): Plugin {
  return {
    name: 'nib-page-style-ownership',
    enforce: 'pre',
    transform(code, id) {
      if (target === 'client' || !applicationModule(root, id)) return null
      const stylesheets = cssImports(code)
      if (stylesheets.length === 0) return null
      throw new Error([
        `Nib cannot deploy stylesheet ${stylesheets[0]} imported by ${cleanId(id)}.`,
        'Move the import to src/style.css, an island or .client behavior module,',
        'or a plugin-owned client entry. Route-scoped page CSS is not supported.',
      ].join(' '))
    },
  }
}
