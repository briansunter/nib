import fs from 'node:fs/promises'
import type { Plugin } from 'vite'
import { markdownToCompiledPage } from './markdown'

export function nibMarkdown(): Plugin {
  return {
    name: 'nib-markdown',
    enforce: 'pre',
    async load(id) {
      const cleanId = id.split('?')[0]
      if (!cleanId.endsWith('/page.md')) return null

      const source = await fs.readFile(cleanId, 'utf8')
      const { html, layout: layoutName, meta } = markdownToCompiledPage(source)
      const layout = layoutName
        ? `import Layout from ${JSON.stringify(`/src/layouts/${layoutName}.tsx`)}`
        : ''
      const pageExpression = layoutName ? 'createElement(Layout, null, content)' : 'content'

      return [
        `import { createElement } from 'react'`,
        layout,
        `export const meta = ${JSON.stringify(meta)}`,
        `const html = ${JSON.stringify(html)}`,
        `const content = createElement('article', {`,
        `  className: 'prose prose-invert max-w-none prose-a:text-sky-300',`,
        `  dangerouslySetInnerHTML: { __html: html }`,
        `})`,
        `export default function MarkdownPage() {`,
        `  return ${pageExpression}`,
        `}`
      ].filter(Boolean).join('\n')
    }
  }
}
