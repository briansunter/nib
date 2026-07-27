import { siteHref, type PageLayoutProps } from '@briansunter/nib'
import ContentEnhancements from '../islands/content-enhancements'

interface ArticleFrontmatter {
  title?: string
  description?: string
  date?: Date
  tags?: string[]
}

export default function ArticleLayout({
  children,
  frontmatter,
}: PageLayoutProps<ArticleFrontmatter>) {
  // Writing entries (root-level slugs) carry a date and back-link to the
  // archive; standalone pages like About/Privacy link home.
  const isWriting = Boolean(frontmatter?.date)
  const backHref = isWriting ? '/pages' : '/'
  const backLabel = isWriting ? '← All writing' : '← Home'
  return (
    <article className="article-page content-column">
      <a className="back-link" href={siteHref(backHref)}>{backLabel}</a>
      <header className="article-header">
        {frontmatter?.date && (
          <p className="eyebrow">
            {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(frontmatter.date)}
          </p>
        )}
        <h1>{frontmatter?.title}</h1>
        {frontmatter?.description && <p className="article-dek">{frontmatter.description}</p>}
        {frontmatter?.tags && frontmatter.tags.length > 0 && (
          <div className="meta-row">
            {frontmatter.tags.map((tag) => (
              <a className="tag" href={siteHref(`/tags/${tag.toLowerCase().replace(/\s+/g, '-')}`)} key={tag}>{tag}</a>
            ))}
          </div>
        )}
      </header>
      {children}
      <ContentEnhancements hydrate="load" />
    </article>
  )
}
