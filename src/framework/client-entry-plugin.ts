import type { Plugin } from 'vite'

export function needsStaticPageReload(file: string): boolean {
  const normalized = file.replaceAll('\\', '/')
  return normalized.endsWith('/nib.config.ts') || /\/src\//.test(normalized)
}

/** Reload static SSR output when an app-authored source module changes. */
export function nibClientEntry(): Plugin {
  return {
    name: 'nib-client-entry',
    handleHotUpdate(context) {
      if (!needsStaticPageReload(context.file)) return
      context.server.ws.send({ type: 'full-reload' })
      return []
    },
  }
}
