import { siteHref, type PageProps } from '@briansunter/nib'
import { Fragment } from 'react'
import type config from '../../../nib.config'
import { PageHero } from '../../components/PageHero'
import Search from '../../components/Search'
import { tagCounts, titledPages } from '../../lib/content-queries'

export const meta = {
  title: 'Search | Brian Sunter',
  description: 'Search the website of Brian Sunter',
}

export default function SearchPage({ collections }: PageProps<typeof config>) {
  const writing = collections.writing.map((entry) => entry.data)
  const popularTopics = tagCounts(writing).slice(0, 10)
  const recentWriting = titledPages(writing).slice(0, 5)

  return (
    <div className="mx-auto max-w-6xl px-3 lg:px-8">
      <div className="search-page py-16 sm:py-20" data-pagefind-ignore>
        <PageHero title="Search" className="mb-12">
          Find articles, projects, recipes, and more across the entire site.
        </PageHero>

        <div className="search-container">
          <Search />
        </div>

        <div data-search-empty-state className="search-empty-state">
          <section aria-labelledby="popular-topics-heading">
            <div className="search-section-head">
              <h2 id="popular-topics-heading" className="search-section-title">
                Popular Topics
              </h2>
              <div className="search-section-rule" aria-hidden="true" />
            </div>

            <div className="topic-list">
              {popularTopics.map(([slug, { displayName, count }], index) => (
                <Fragment key={slug}>
                  <a href={siteHref(`/tags/${slug}`)} className="topic-link focus-accent">
                    <span className="topic-hash" aria-hidden="true">#</span>{' '}
                    <span>{displayName}</span>{' '}
                    <span className="topic-count">{count}</span>
                  </a>
                  {index < popularTopics.length - 1 ? ' ' : null}
                </Fragment>
              ))}
            </div>
          </section>

          <section aria-labelledby="recent-writing-heading">
            <div className="search-section-head">
              <h2 id="recent-writing-heading" className="search-section-title">
                Recent Writing
              </h2>
              <div className="search-section-rule" aria-hidden="true" />
            </div>

            <ol className="recent-writing-list">
              {recentWriting.map((post) => (
                <li className="recent-writing-item" key={post.slug}>
                  <a
                    href={siteHref(`/${post.slug}`)}
                    className="recent-writing-link focus-accent"
                  >
                    {post.title}
                  </a>
                  <time
                    className="mt-2 block font-sans text-sm leading-[1.4] text-ink-muted"
                    dateTime={post.date.toISOString()}
                  >
                    {post.date.toLocaleDateString('en-us', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}
