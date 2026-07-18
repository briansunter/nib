import type { Plugin } from 'vite'

const MODULE_ENTRY_SCRIPT = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'][^"']+["'])[^>]*><\/script>/i

export function needsStaticPageReload(file: string): boolean {
  const normalized = file.replaceAll('\\', '/')
  return /\/src\/(?:pages|layouts)\//.test(normalized)
    || normalized.endsWith('/src/App.tsx')
    || normalized.endsWith('/src/site.config.ts')
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
        if (html.includes('data-nib-islands')) return html
        return html.replace(MODULE_ENTRY_SCRIPT, (script) => (
          script.replace('<script', '<script data-nib-islands')
        ))
      },
    },
  }
}
