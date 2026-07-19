import { Image } from '@briansunter/nib-images'
import { siteHref } from '@briansunter/nib'
import type { Post } from '../content'
import { imageMap } from '../data/images'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date)
}

function PostItem({ post, featured }: { post: Post; featured: boolean }) {
  const cover = post.cover ? imageMap[post.cover] : undefined

  return (
    <article className={featured ? 'post-card post-card--featured' : 'post-card'}>
      <a className="post-card__link" href={siteHref(`/notes/${post.slug}`)}>
        <div className="post-card__media">
          {cover ? (
            featured ? (
              <Image
                src={cover}
                alt={`Cover image for ${post.title}`}
                layout="full"
                widths={[480, 720, 960]}
                sizes="(min-width: 900px) 860px, 100vw"
                priority
                className="cover-image"
              />
            ) : (
              <Image
                src={cover}
                alt=""
                layout="fixed"
                width={128}
                densities={[1, 2]}
                loading="lazy"
                className="cover-image"
              />
            )
          ) : (
            <span className="gradient-placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="post-card__body">
          <span className="eyebrow">{featured ? 'Latest' : 'Writing'}</span>
          <h3>{post.title}</h3>
          <p>{post.description}</p>
          <div className="meta-row">
            <time dateTime={post.date.toISOString()}>{formatDate(post.date)}</time>
            {post.tags.slice(0, 2).map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          </div>
        </div>
      </a>
    </article>
  )
}

export function PostList({ posts }: { posts: readonly { data: Post }[] }) {
  return (
    <div className="post-list">
      {posts.map((entry, index) => (
        <PostItem key={entry.data.slug} post={entry.data} featured={index === 0} />
      ))}
    </div>
  )
}
