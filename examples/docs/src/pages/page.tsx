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
        <span className="home-page__note-mark" aria-hidden="true">
          <img src={siteHref('/nib-mark.svg')} alt="" />
        </span>
        <p className="home-page__note-label">At a glance</p>
        <p>Folders become routes. Markdown becomes HTML. Islands add the small moments that need a browser.</p>
      </aside>
      <section className="home-page__example" aria-labelledby="home-example-title">
        <div className="home-page__example-intro">
          <p className="home-page__eyebrow">A small site, end to end</p>
          <h2 id="home-example-title">The file tree is the guide.</h2>
          <p>Initialize a site, turn files into routes, and add browser behavior only where you ask for it.</p>
        </div>
        <div className="home-page__example-grid">
          <article className="home-page__example-card">
            <header>
              <span>01</span>
              <h3>Initialize a site</h3>
            </header>
            <pre><code>{'npx @briansunter/nib init my-site\ncd my-site\nnpm run dev'}</code></pre>
            <p>Start with a ready-to-edit project.</p>
          </article>
          <article className="home-page__example-card">
            <header>
              <span>02</span>
              <h3>Folder routing</h3>
            </header>
            <pre><code>{'src/pages/about/page.tsx\n→ /about/'}</code></pre>
            <p>A folder becomes a URL.</p>
          </article>
          <article className="home-page__example-card">
            <header>
              <span>03</span>
              <h3>TSX + Markdown</h3>
            </header>
            <pre><code>{'// page.tsx\nexport default () =>\n  <h1>Hi</h1>\n\n// page.md\n# Notes'}</code></pre>
            <p>Choose structure or content.</p>
          </article>
          <article className="home-page__example-card">
            <header>
              <span>04</span>
              <h3>React islands</h3>
            </header>
            <pre><code>{'// src/islands/counter.tsx\n<Counter hydrate="load" />'}</code></pre>
            <p>Only the island gets browser JavaScript.</p>
          </article>
        </div>
      </section>
    </section>
  )
}
