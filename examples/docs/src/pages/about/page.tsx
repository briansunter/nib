import { siteHref, type PageMeta } from '@briansunter/nib'

export const meta: PageMeta = {
  title: 'About',
  description: 'How Nib works.'
}

export default function AboutPage() {
  return (
    <article className="about-page">
      <p className="about-page__eyebrow">About Nib</p>
      <h1>Static by default.<br /><em>Interactive by choice.</em></h1>
      <p className="about-page__lede">
        Nib is a small React framework for people who want to make a site, not
        assemble an application platform first.
      </p>
      <div className="about-page__details">
        <section>
          <span className="about-page__number">01</span>
          <h2>Files have a job</h2>
          <p>Pages live in folders, Markdown holds the words, and the build turns both into routes you can host anywhere.</p>
        </section>
        <section>
          <span className="about-page__number">02</span>
          <h2>JavaScript earns its place</h2>
          <p>Most of a site stays static. When a control needs state, define one React island and hydrate that boundary.</p>
        </section>
      </div>
      <a className="button button--primary" href={siteHref('/docs/getting-started/')}>
        Get started <span aria-hidden="true">→</span>
      </a>
    </article>
  )
}
