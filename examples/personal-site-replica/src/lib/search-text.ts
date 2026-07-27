// Pure, dependency-free text extraction for the build-time search index.
// Each helper turns one content source into searchable plain text. They are
// deterministic for a given input and never touch the filesystem.

const HTML_TAG = /<[^>]+>/g
const ANY_ENTITY = /&[a-zA-Z#0-9]+;/g

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Strips a leading YAML frontmatter block delimited by `---` fences. */
function stripFrontmatter(source: string): string {
  if (!source.startsWith('---')) return source
  const end = source.indexOf('\n---', 3)
  if (end === -1) return source
  const afterFence = source.indexOf('\n', end + 4)
  return afterFence === -1 ? '' : source.slice(afterFence + 1)
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&nbsp;/g, ' ')
    .replace(ANY_ENTITY, ' ')
}

/** Removes HTML markup and entities, collapsing the result to plain text. */
export function htmlToPlainText(html: string): string {
  return normalizeWhitespace(decodeEntities(html.replace(HTML_TAG, ' ')))
}

/**
 * Removes Markdown frontmatter, markup, links, images, and code into plain
 * text while keeping the readable prose (including link anchor text).
 */
export function markdownToPlainText(source: string): string {
  const body = stripFrontmatter(source)
  return normalizeWhitespace(
    decodeEntities(
      body
        // Fenced code blocks and inline code (keep inline code contents).
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]+)`/g, '$1')
        // Images: keep the alt text.
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/!\[([^\]]*)\]\[[^\]]*\]/g, '$1')
        // Links: keep the anchor text.
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
        // ATX headings, emphasis, blockquote, and list markers.
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/[*_~]+/g, '')
        .replace(/^>\s?/gm, '')
        .replace(/^[-+*]\s+/gm, '')
        .replace(/^\d+\.\s+/gm, '')
        // Any Markdown-embedded HTML.
        .replace(HTML_TAG, ' '),
    ),
  )
}

/**
 * Lightly cleans CookLang recipe source into searchable plain text by dropping
 * quantity/timer braces and ingredient/cookware/timer markers.
 */
export function cooklangToPlainText(source: string): string {
  return normalizeWhitespace(
    source
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/[@#~]/g, ' '),
  )
}
