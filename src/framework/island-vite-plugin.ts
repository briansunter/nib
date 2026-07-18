import type { Plugin } from 'vite'

const MODULE_ENTRY_SCRIPT = /<!--nib-islands-entry-->\s*(<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'][^"']+["'])[^>]*><\/script>)/i

export function needsStaticPageReload(file: string): boolean {
  const normalized = file.replaceAll('\\', '/')
  return /\/src\/(?:pages|layouts)\//.test(normalized)
    || /\/src\/framework\//.test(normalized)
    || normalized.endsWith('/src/App.tsx')
    || normalized.endsWith('/src/site.config.ts')
    || normalized.endsWith('/src/routes.ts')
    || normalized.endsWith('/src/entry-server.tsx')
    || normalized.endsWith('/src/entry-islands.tsx')
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
        return html.replace(MODULE_ENTRY_SCRIPT, (_match, script: string) => (
          script.includes('data-nib-islands')
            ? script
            : script.replace('<script', '<script data-nib-islands')
        ))
      },
    },
  }
}
