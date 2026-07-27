import { siteHref } from '@briansunter/nib'
import { Image } from '@briansunter/nib-images'
import type { Writing } from '../content'
import { writingImageMap } from '../data/writing-images'
import { randomGradient } from '../lib/randomGradient'
import { PostCardMeta } from './PostCardMeta'

function visibleTags(tags: readonly string[], limit = 3): string[] {
  return tags.slice(0, limit)
}

function featuredLabel(post: Writing): string {
  const first = visibleTags(post.tags, 1)[0]
  return first ? `Latest · ${first}` : 'Latest'
}

function FeaturedPost({ post }: { post: Writing }) {
  const cover = writingImageMap[post.slug]
  return (
    <article className="featured-post thumb-hover">
      <a href={siteHref(`/${post.slug}`)} className="card-link flex flex-col gap-5">
        <div className="thumb aspect-feature w-full overflow-hidden rounded-xl">
          {cover ? (
            <Image
              src={cover}
              alt={`Cover image for ${post.title}`}
              layout="constrained"
              width={800}
              maxWidth={800}
              widths={[400, 600, 800]}
              sizes="(min-width: 768px) 800px, 100vw"
              priority
              className="thumb-hover-img h-full w-full object-cover"
            />
          ) : (
            <div className="thumb-hover-img h-full w-full" style={{ background: randomGradient(post.slug) }} />
          )}
        </div>
        <div className="min-w-0">
          <span className="overline-label mb-2.5 inline-block">{featuredLabel(post)}</span>
          <h3 className="mb-2.5 text-title font-bold leading-[1.1] tracking-tight text-ink">{post.title}</h3>
          {post.description && (
            <p className="dek line-clamp-4 max-w-[62ch] text-lg sm:text-xl">{post.description}</p>
          )}
        </div>
      </a>
      <PostCardMeta date={post.date} tags={visibleTags(post.tags)} className="mt-3" />
    </article>
  )
}

function PostListItem({ post }: { post: Writing }) {
  const cover = writingImageMap[post.slug]
  return (
    <article className="post-item card-outdent thumb-hover bordered">
      <div className="flex items-stretch gap-4 sm:gap-5">
        <a
          href={siteHref(`/${post.slug}`)}
          tabIndex={-1}
          aria-hidden="true"
          className="card-link w-20 h-20 flex-shrink-0 overflow-hidden rounded-lg sm:w-32 sm:h-32"
        >
          {cover ? (
            <Image
              src={cover}
              alt=""
              layout="constrained"
              width={128}
              widths={[96, 160, 256]}
              sizes="(min-width: 640px) 128px, 80px"
              className="thumb-hover-img h-full w-full object-cover"
            />
          ) : (
            <div className="thumb-hover-img h-full w-full" style={{ background: randomGradient(post.slug) }} />
          )}
        </a>
        <div className="flex min-w-0 flex-1 flex-col">
          <a href={siteHref(`/${post.slug}`)} className="card-link block">
            <h3 className="mb-1.5 text-lg font-bold leading-[1.2] tracking-tight text-ink line-clamp-2 sm:text-2xl">
              {post.title}
            </h3>
            {post.description && (
              <p className="dek line-clamp-4 max-w-[62ch] text-base sm:text-lg">{post.description}</p>
            )}
          </a>
          <PostCardMeta date={post.date} tags={visibleTags(post.tags)} className="mt-auto pt-2" />
        </div>
      </div>
    </article>
  )
}

/** Homepage writing list. Mirrors BlogList.astro: heading + archive link, one featured post then the rest. */
export function BlogList({ posts }: { posts: readonly Writing[] }) {
  const [featured, ...rest] = posts
  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className="mb-8 flex items-baseline justify-between">
        <h2 className="text-h2 font-bold tracking-tight text-ink">Writing</h2>
        <a
          href={siteHref('/pages')}
          className="text-sm font-medium text-ink-secondary transition-colors hover:text-accent"
        >
          View archive →
        </a>
      </div>
      <div className="post-list flex flex-col">
        {featured && <FeaturedPost post={featured} />}
        {rest.map((post) => (
          <PostListItem key={post.slug} post={post} />
        ))}
      </div>
    </section>
  )
}
