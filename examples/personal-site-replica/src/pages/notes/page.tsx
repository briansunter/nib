import { type PageProps, siteHref } from '@briansunter/nib'
import type config from '../../../nib.config'
import { PostList } from '../../components/PostList'
import { SectionHeading } from '../../components/SectionHeading'

export const meta = {
  title: 'Writing',
  description: 'Notes about technology, productivity, and creative practice.',
}

export default function WritingPage({ collections }: PageProps<typeof config>) {
  return (
    <div className="page-stack">
      <header className="page-hero content-column">
        <p className="eyebrow">Archive</p>
        <h1>Writing</h1>
        <p className="lead">Notes on building useful things, finding better systems, and paying attention to the world around them.</p>
      </header>
      <section className="content-column">
        <SectionHeading title={`${collections.posts.length} notes`} href="/search" linkLabel="Search" />
        <PostList posts={collections.posts} />
        <p className="small-note"><a href={siteHref('/rss.xml')}>Subscribe via RSS →</a></p>
      </section>
    </div>
  )
}
