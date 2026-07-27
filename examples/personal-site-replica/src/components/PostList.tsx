import { siteHref } from '@briansunter/nib'
import type { Writing } from '../content'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date)
}

function PostItem({ post, featured }: { post: Writing; featured: boolean }) {
  return (
    <article className={featured ? 'post-card post-card--featured' : 'post-card'}>
      <a className="post-card__link" href={siteHref(`/${post.slug}`)}>
        <div className="post-card__body">
          <span className="eyebrow">{featured ? 'Latest' : 'Writing'}</span>
          <h3>{post.title}</h3>
          {post.description && <p>{post.description}</p>}
          <div className="meta-row">
            <time dateTime={post.date.toISOString()}>{formatDate(post.date)}</time>
            {post.tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          </div>
        </div>
      </a>
    </article>
  )
}

export function PostList({ posts }: { posts: readonly { data: Writing }[] }) {
  return (
    <div className="post-list">
      {posts.map((entry, index) => (
        <PostItem key={entry.data.slug} post={entry.data} featured={index === 0} />
      ))}
    </div>
  )
}
