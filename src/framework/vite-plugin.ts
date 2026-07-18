import fs from 'node:fs/promises'
import path from 'node:path'
import { normalizePath, type Plugin } from 'vite'
import { getMarkdownLayoutName, markdownToCompiledPage } from './markdown'

async function layoutImport(pageFile: string, root: string, layoutName: string): Promise<string> {
  const layoutsRoot = path.resolve(root, 'src/layouts')
  const layoutFile = path.resolve(layoutsRoot, `${layoutName}.tsx`)
  const relativeToLayouts = path.relative(layoutsRoot, layoutFile)

  if (relativeToLayouts.startsWith('..') || path.isAbsolute(relativeToLayouts)) {
    throw new Error(`Markdown layout must be inside src/layouts: ${layoutName}`)
  }

  try {
    await fs.access(layoutFile)
  } catch {
    throw new Error(`Unknown Markdown layout "${layoutName}". Expected ${normalizePath(path.relative(root, layoutFile))}`)
  }

  const relativeToPage = normalizePath(path.relative(path.dirname(pageFile), layoutFile))
  const importPath = relativeToPage.startsWith('.') ? relativeToPage : `./${relativeToPage}`
  return `import Layout from ${JSON.stringify(importPath)}`
}

export function miniStaticMarkdown(): Plugin {
  let root = process.cwd()

  return {
    name: 'mini-static-markdown',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    async load(id) {
      const cleanId = id.split('?')[0]
      if (!cleanId.endsWith('/page.md')) return null

      const source = await fs.readFile(cleanId, 'utf8')
      const { html, meta } = markdownToCompiledPage(source)
      const layoutName = getMarkdownLayoutName(meta)
      const layout = layoutName ? await layoutImport(cleanId, root, layoutName) : ''
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
