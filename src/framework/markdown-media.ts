/**
 * Small, explicit Markdown media adapter. It handles the media shapes that
 * are safe to represent as ordinary static HTML while leaving arbitrary raw
 * HTML to the caller's `allowDangerousHtml` policy.
 */

export interface MarkdownMediaOptions {
  /** Hosts permitted for raw iframe embeds. An empty list rejects all. */
  readonly iframeHosts?: readonly string[]
  readonly iframeTitle?: string
}

interface HastNode {
  type?: string
  value?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

function element(tagName: string, properties: Record<string, unknown>): HastNode {
  return { type: 'element', tagName, properties, children: [] }
}

function attributeValue(attributes: string, name: string): string | undefined {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
  return match?.[2]
}

function allowedIframeSource(value: string, hosts: ReadonlySet<string>): boolean {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && hosts.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

function rawIframe(
  value: string,
  options: Required<Pick<MarkdownMediaOptions, 'iframeTitle'>> & { iframeHosts: ReadonlySet<string> },
): HastNode | undefined {
  const match = value.match(/^\s*<iframe\b([\s\S]*?)>\s*<\/iframe>\s*$/i)
  if (!match) return undefined
  const source = attributeValue(match[1]!, 'src')
  if (!source || !allowedIframeSource(source, options.iframeHosts)) return undefined
  return element('iframe', {
    src: source,
    title: attributeValue(match[1]!, 'title') ?? options.iframeTitle,
    loading: attributeValue(match[1]!, 'loading') ?? 'lazy',
    allowFullScreen: true,
  })
}

function visit(
  node: HastNode | undefined,
  options: Required<Pick<MarkdownMediaOptions, 'iframeTitle'>> & { iframeHosts: ReadonlySet<string> },
): void {
  if (!node?.children) return
  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index]
    if (!child) continue
    if (child.type === 'raw' && child.value !== undefined) {
      const iframe = rawIframe(child.value, options)
      if (iframe) {
        node.children[index] = iframe
        continue
      }
      if (/^\s*<iframe\b[\s\S]*<\/iframe>\s*$/i.test(child.value)) {
        node.children.splice(index, 1)
        index -= 1
        continue
      }
    }
    if (child.type === 'element' && child.tagName === 'img') {
      const properties = child.properties ?? {}
      const source = String(properties.src ?? '')
      const alt = String(properties.alt ?? '')
      if (/^\/videos\//i.test(source)) {
        node.children[index] = element('video', {
          class: 'post-video',
          src: source,
          controls: true,
          preload: 'metadata',
          ...( /\bautoplay\b/i.test(alt)
            ? { autoPlay: true, muted: true, loop: true, playsInline: true, dataAutoplayVideo: true }
            : {}),
        })
        continue
      }
      if (source.startsWith('/__nib-embed__/')) {
        let embedSource = source.slice('/__nib-embed__/'.length)
        try {
          embedSource = decodeURIComponent(embedSource)
        } catch {
          // Preserve malformed markers as ordinary images.
        }
        if (allowedIframeSource(embedSource, options.iframeHosts)) {
          node.children[index] = element('iframe', {
            src: embedSource,
            title: options.iframeTitle,
            loading: 'lazy',
            allowFullScreen: true,
          })
          continue
        }
      }
    }
    visit(child, options)
  }
}

/** A rehype plugin for explicitly trusted, allow-listed media content. */
export function markdownMedia(options: MarkdownMediaOptions = {}) {
  const iframeHosts = new Set((options.iframeHosts ?? []).map((host) => host.toLowerCase()))
  const normalized = {
    iframeHosts,
    iframeTitle: options.iframeTitle ?? 'Embedded media',
  }
  return () => (tree: HastNode) => visit(tree, normalized)
}
