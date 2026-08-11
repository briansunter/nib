import type { Plugin } from 'vite'

const BEHAVIOR_ENTRY_SCRIPT = /<!--nib-behaviors-entry-->\s*(<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'][^"']+["'])[^>]*><\/script>)/i

/** @internal Exported for framework contract tests, not from the package API. */
export function markBehaviorEntryScript(html: string): string {
  return html.replace(BEHAVIOR_ENTRY_SCRIPT, (_match, script: string) => (
    script.includes('data-nib-behaviors')
      ? script
      : script.replace('<script', '<script data-nib-behaviors')
  ))
}

export function needsStaticPageReload(file: string): boolean {
  const normalized = file.replaceAll('\\', '/')
  return normalized.endsWith('/nib.config.ts') || /\/src\//.test(normalized)
}

export function nibClientEntry(): Plugin {
  return {
    name: 'nib-client-entry',
    handleHotUpdate(context) {
      if (!needsStaticPageReload(context.file)) return
      context.server.ws.send({ type: 'full-reload' })
      return []
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return markBehaviorEntryScript(html)
      },
    },
  }
}
