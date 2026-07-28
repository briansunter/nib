import type { Parent, Root } from 'mdast'
import { visit } from 'unist-util-visit'
import { getMermaidSnapshot } from '../data/mermaid-snapshots'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * Emit the source site's build-rendered SVG for its known diagrams. Nib's
 * Markdown compiler is synchronous, so unknown diagrams retain the semantic
 * client-rendered fallback instead of making the whole pipeline asynchronous.
 */
export function remarkMermaid() {
  return (tree: Root, file: { path?: string }) => {
    let mermaidIndex = 0
    visit(tree, 'code', (node: any, index?: number, parent?: Parent) => {
      if (index === undefined || !parent || node.lang?.toLowerCase() !== 'mermaid') return
      const source = String(node.value ?? '')
      const snapshot = getMermaidSnapshot(file.path, mermaidIndex, source)
      mermaidIndex += 1
      parent.children[index] = snapshot
        ? {
            type: 'paragraph',
            children: [{ type: 'html', value: snapshot }],
          } as any
        : {
            type: 'html',
            value: `<div class="mermaid" data-mermaid-source="${escapeHtml(source)}">${escapeHtml(source)}</div>`,
          }
    })
  }
}
