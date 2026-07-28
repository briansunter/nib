import { defineLayout, siteHref } from '@briansunter/nib'
import type config from '../../../nib.config'
import type { BlogFrontmatter } from '../../content'

export default defineLayout<BlogFrontmatter, typeof config>(function PostLayout({
  Content,
  frontmatter,
}) {
  if (!Content || !frontmatter) return null
  const published = frontmatter.date.toISOString().slice(0, 10)

  return (
    <article className="post">
      <header className="post-header">
        <a className="back-link" href={siteHref('/posts/')}>
          <span aria-hidden="true">←</span> All posts
        </a>
        <p className="eyebrow">{frontmatter.tags.join(' · ')}</p>
        <h1>{frontmatter.title}</h1>
        <p className="lede">{frontmatter.description}</p>
        <time dateTime={published}>{published}</time>
      </header>
      <Content as="div" className="prose" />
    </article>
  )
})
