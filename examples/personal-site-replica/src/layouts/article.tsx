import { siteHref, type PageLayoutProps } from '@briansunter/nib'
import { Image } from '@briansunter/nib-images'
import type config from '../../nib.config'
import { NewsletterSignup } from '../components/NewsletterSignup'
import { SocialShare } from '../components/SocialShare'
import type { Writing } from '../content'
import { writingImageMap } from '../data/writing-images'
import { ContentEnhancements } from '../client-behaviors'
import { adjacentPages, relatedPages } from '../lib/content-queries'
import { formatArticleDate, formatDisplayDate } from '../lib/date'

interface ArticleFrontmatter {
  title?: string
  description?: string
  date?: Date
  lastMod?: Date
  math?: boolean
  tags?: string[]
}

export default function ArticleLayout({
  Content,
  frontmatter,
  route,
  site,
  collections,
}: PageLayoutProps<ArticleFrontmatter, typeof config>) {
  if (!Content) throw new Error(`Article layout requires Markdown content for ${route.path}`)
  const slug = route.path.replace(/^\/+|\/+$/g, '')
  const writing = collections.writing.map((entry) => entry.data as Writing)
  const current = writing.find((entry) => entry.slug === slug)
  const date = current?.date ?? frontmatter?.date
  const title = current?.title ?? frontmatter?.title ?? slug
  const description = current?.description ?? frontmatter?.description ?? ''
  const wordCount = current?.wordCount ?? 0
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 230))
  const cover = current ? writingImageMap[current.slug] : undefined
  const adjacent = adjacentPages(writing, slug)
  const related = current ? relatedPages(writing, current, 3) : []
  const origin = (site.origin ?? 'https://briansunter.com').replace(/\/$/, '')
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    datePublished: date?.toISOString(),
    dateModified: current?.lastMod?.toISOString() ?? date?.toISOString(),
    mainEntityOfPage: `${origin}/${slug}`,
    author: { '@type': 'Person', name: 'Brian Sunter', url: origin },
    publisher: { '@type': 'Person', name: 'Brian Sunter', url: origin },
    keywords: current?.tags,
    image: current?.cover ? new URL(current.cover, `${origin}/`).href : undefined,
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="mx-auto max-w-5xl px-3 pb-10 pt-8 lg:px-8 lg:pb-14 lg:pt-12">
        <div className="text-center">
          {date && (
            <p className="overline-label mb-3">
              <time dateTime={date.toISOString()}>
                {formatArticleDate(date)}
              </time>
              {' · '}{readingTimeMinutes} MIN READ
            </p>
          )}
          <h1 className="font-sans text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl lg:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="mx-auto mt-4 max-w-2xl font-serif text-lg leading-relaxed text-ink-secondary lg:text-xl">
              {description}
            </p>
          )}
        </div>
      </header>
      {cover && (
        <div className="mx-auto mb-12 max-w-6xl px-3 lg:px-8">
          <Image
            src={cover}
            alt={`Cover image for ${title}`}
            layout="constrained"
            width={1200}
            maxWidth={1200}
            widths={[400, 800, 1200]}
            sizes="(min-width: 1200px) 1152px, 100vw"
            priority
            className="aspect-cover max-h-[500px] w-full rounded-xl object-cover"
            data-pagefind-meta="image[src], image_alt[alt]"
          />
        </div>
      )}
      <Content
        as="article"
        className="prose-editorial mx-auto max-w-5xl px-3 lg:px-8"
        data-pagefind-body=""
      />
      <footer className="mx-auto max-w-5xl px-3 pb-12 lg:px-8">
        <section className="mx-auto mt-14 max-w-3xl">
          <NewsletterSignup />
        </section>
        {(adjacent.older || adjacent.newer) && (
          <nav className="mt-12 border-t border-border pt-10" aria-label="Adjacent posts">
            <div className="grid gap-5 sm:grid-cols-2">
              {adjacent.older && (
                <a
                  href={siteHref(`/${adjacent.older.slug}`)}
                  className="group block rounded-lg border border-border bg-surface-elevated p-5 transition-colors hover:border-ink-muted hover:bg-surface-hover focus-accent"
                >
                  <span className="overline-label">Older</span>
                  <span className="mt-2 block font-serif text-xl leading-snug text-ink-secondary transition-colors group-hover:text-ink">
                    {adjacent.older.title}
                  </span>
                </a>
              )}
              {adjacent.newer && (
                <a
                  href={siteHref(`/${adjacent.newer.slug}`)}
                  className="group block rounded-lg border border-border bg-surface-elevated p-5 transition-colors hover:border-ink-muted hover:bg-surface-hover focus-accent sm:col-start-2 sm:text-right"
                >
                  <span className="overline-label">Newer</span>
                  <span className="mt-2 block font-serif text-xl leading-snug text-ink-secondary transition-colors group-hover:text-ink">
                    {adjacent.newer.title}
                  </span>
                </a>
              )}
            </div>
          </nav>
        )}
        {related.length > 0 && (
          <section className="mt-12 border-t border-border pt-10" aria-labelledby="related-heading">
            <h2 id="related-heading" className="overline-label mb-5">Related</h2>
            <ul className="m-0 list-none divide-y divide-border p-0">
              {related.map((post) => (
                <li key={post.slug}>
                  <a
                    href={siteHref(`/${post.slug}`)}
                    className="group flex flex-col gap-1 rounded-sm py-4 transition-colors hover:text-accent focus-accent"
                  >
                    <span className="font-serif text-lg leading-snug text-ink-secondary transition-colors group-hover:text-ink sm:text-xl">
                      {post.title}
                    </span>
                    <time className="overline-label font-sans" dateTime={post.date.toISOString()}>
                      {formatDisplayDate(post.date)}
                    </time>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <SocialShare slug={slug} title={title} label="Share this article" />
      </footer>
      <ContentEnhancements props={{}} hydrate="load" />
    </>
  )
}
