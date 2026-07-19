import { siteHref, type PageLayoutProps } from '@briansunter/nib'

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
  return (
    <article className="article-page content-column">
      <a className="back-link" href={siteHref('/notes')}>← All writing</a>
      <header className="article-header">
        {frontmatter?.date && (
          <p className="eyebrow">
            {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(frontmatter.date)}
          </p>
        )}
        <h1>{frontmatter?.title}</h1>
        {frontmatter?.description && <p className="article-dek">{frontmatter.description}</p>}
        {frontmatter?.tags && (
          <div className="meta-row">
            {frontmatter.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          </div>
        )}
      </header>
      {children}
    </article>
  )
}
