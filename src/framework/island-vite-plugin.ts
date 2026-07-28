import type { Plugin } from 'vite'

const ISLAND_ENTRY_SCRIPT = /<!--nib-islands-entry-->\s*(<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'][^"']+["'])[^>]*><\/script>)/i
const BEHAVIOR_ENTRY_SCRIPT = /<!--nib-behaviors-entry-->\s*(<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'][^"']+["'])[^>]*><\/script>)/i

export function needsStaticPageReload(file: string): boolean {
  const normalized = file.replaceAll('\\', '/')
  return normalized.endsWith('/nib.config.ts')
    || (/\/src\//.test(normalized) && !/\/src\/islands\//.test(normalized))
}

export function nibIslandsEntry(): Plugin {
  return {
    name: 'nib-islands-entry',
    handleHotUpdate(context) {
      if (!needsStaticPageReload(context.file)) return
      context.server.ws.send({ type: 'full-reload' })
      return []
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(ISLAND_ENTRY_SCRIPT, (_match, script: string) => (
            script.includes('data-nib-islands')
              ? script
              : script.replace('<script', '<script data-nib-islands')
          ))
          .replace(BEHAVIOR_ENTRY_SCRIPT, (_match, script: string) => (
            script.includes('data-nib-behaviors')
              ? script
              : script.replace('<script', '<script data-nib-behaviors')
          ))
      },
    },
  }
}
