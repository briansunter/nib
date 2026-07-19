import type { PageLayoutProps } from '@briansunter/nib'
import type { MarkdownFrontmatter } from '../../content'

export default function AboutLayout({
  children,
  frontmatter,
}: PageLayoutProps<MarkdownFrontmatter>) {
  return (
    <section data-eyebrow={frontmatter?.eyebrow}>
      {children}
    </section>
  )
}
