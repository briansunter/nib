import type { Element, Root } from 'hast'
import GithubSlugger from 'github-slugger'
import { visit } from 'unist-util-visit'

const rawNodeTypes = new Set(['text', 'raw', 'mdxTextExpression'])
const codeTagNames = new Set(['code', 'pre'])

/**
 * Add the same unique GitHub-style heading IDs that Astro adds by default.
 *
 * This intentionally mirrors Astro's Markdown heading text collection instead
 * of DOM `textContent`: KaTeX and raw HTML headings otherwise produce
 * different anchors.
 */
export function rehypeHeadingIds() {
  return (tree: Root) => {
    const slugger = new GithubSlugger()
    visit(tree, 'element', (node: Element) => {
      const [, level] = /h([0-6])/.exec(node.tagName) ?? []
      if (!level) return

      let text = ''
      visit(node, (child: any, _index, parent: any) => {
        if (child.type === 'element' || parent == null) return
        if (child.type === 'raw' && /^\n?<.*>\n?$/.test(child.value)) return
        if (!rawNodeTypes.has(child.type)) return
        text += codeTagNames.has(parent.tagName)
          ? child.value
          : child.value.replace(/\{/g, '${')
      })

      node.properties ??= {}
      if (typeof node.properties.id !== 'string') {
        node.properties.id = slugger.slug(text)
      }
    })
  }
}
