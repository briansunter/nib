import { siteHref, type PageMeta } from '@briansunter/nib'

export const meta: PageMeta = {
  title: 'Home',
  description: 'A static-site framework for React, Markdown, data pages, and opt-in islands.'
}

export default function HomePage() {
  return (
    <section className="home-page">
      <div className="home-page__hero">
        <p className="home-page__eyebrow">Nib / static-first web</p>
        <h1>Build the page.<br /><em>Ship the HTML.</em></h1>
        <p className="home-page__lede">
          A small React framework for sites that want the clarity of static files,
          the comfort of Markdown, and interaction only where it earns its place.
        </p>
        <div className="home-page__actions">
          <a className="button button--primary" href={siteHref('/docs/getting-started/')}>
            Get started <span aria-hidden="true">→</span>
          </a>
          <a className="button button--quiet" href={siteHref('/docs/')}>
            Read the guide <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
      <aside className="home-page__note" aria-label="Nib at a glance">
        <span className="home-page__note-mark" aria-hidden="true">n</span>
        <p className="home-page__note-label">At a glance</p>
        <p>Folders become routes. Markdown becomes HTML. Islands add the small moments that need a browser.</p>
      </aside>
      <div className="home-page__principles" aria-label="Nib principles">
        <div>
          <strong>01</strong>
          <span>Write plainly</span>
          <p>TSX for structure. Markdown for ideas.</p>
        </div>
        <div>
          <strong>02</strong>
          <span>Ship lightly</span>
          <p>Prerender every route to portable HTML.</p>
        </div>
        <div>
          <strong>03</strong>
          <span>Choose interaction</span>
          <p>Hydrate only explicit React islands.</p>
        </div>
      </div>
    </section>
  )
}
