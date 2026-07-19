import { siteHref, type PageMeta } from '@briansunter/nib'

export const meta: PageMeta = {
  title: 'Home',
  description: 'A static-site framework for React, Markdown, data pages, and opt-in islands.'
}

export default function HomePage() {
  return (
    <section className="home-page">
      <div className="home-page__hero">
        <div className="home-page__hero-copy">
          <p className="home-page__eyebrow">
            <span className="home-page__eyebrow-dot" aria-hidden="true" />
            Nib / static-first web
          </p>
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
          <dl className="home-page__facts" aria-label="Nib at a glance">
            <div>
              <dt>default output</dt>
              <dd>HTML</dd>
            </div>
            <div>
              <dt>authoring</dt>
              <dd>TSX + MD</dd>
            </div>
            <div>
              <dt>browser code</dt>
              <dd>opt-in</dd>
            </div>
          </dl>
        </div>
      </div>
      <aside className="home-page__note home-page__assembly" aria-label="A Nib build at a glance">
        <div className="home-page__assembly-topline">
          <p className="home-page__note-label">The Nib loop</p>
          <span className="home-page__assembly-status">
            <span aria-hidden="true" /> ready to build
          </span>
        </div>
        <div className="home-page__assembly-output">
          <span className="home-page__note-mark" aria-hidden="true">
            <img src={siteHref('/nib-mark.svg')} alt="" />
          </span>
          <div>
            <span className="home-page__assembly-label">output / 001</span>
            <strong>index.html</strong>
            <span>complete HTML, ready to host</span>
          </div>
        </div>
        <ol className="home-page__assembly-steps" aria-label="Build sequence">
          <li><span>01</span><code>src/pages</code><small>routes</small></li>
          <li><span>02</span><code>page.md</code><small>content</small></li>
          <li><span>03</span><code>nib build</code><small>output</small></li>
        </ol>
        <p>Folders become routes. Markdown becomes HTML. Islands add the small moments that need a browser.</p>
      </aside>
      <section className="home-page__example" aria-labelledby="home-example-title">
        <div className="home-page__example-head">
          <div className="home-page__example-intro">
            <p className="home-page__eyebrow">A small site, end to end</p>
            <h2 id="home-example-title">The file tree is the guide.</h2>
            <p>Initialize a site, turn files into routes, and add browser behavior only where you ask for it.</p>
          </div>
          <a className="home-page__example-link" href={siteHref('/docs/getting-started/')}>
            Start with a route <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="home-page__example-grid">
          <article className="home-page__example-card home-page__example-card--setup">
            <header>
              <span>01 / SETUP</span>
              <h3>Initialize a site</h3>
            </header>
            <pre><code>{'npx @briansunter/nib init my-site\ncd my-site\nnpm run dev'}</code></pre>
            <p>Scaffold the config, pages, styles, and an island example.</p>
          </article>
          <article className="home-page__example-card home-page__example-card--tree">
            <header>
              <span>02 / FILES</span>
              <h3>Folders map to the site</h3>
            </header>
            <pre><code>{'my-site/\n├── nib.config.ts\n└── src/\n    ├── pages/\n    │   ├── page.tsx\n    │   ├── about/page.md\n    │   ├── posts/page.csv\n    │   └── layout.tsx\n    ├── content/posts/\n    └── islands/counter.tsx'}</code></pre>
            <p>Page folders become URLs; data files can generate many routes.</p>
          </article>
          <article className="home-page__example-card">
            <header>
              <span>03 / PAGES</span>
              <h3>Write a route in TSX</h3>
            </header>
            <pre><code>{'// src/pages/about/page.tsx\nexport default () =>\n  <h1>About</h1>\n\n// → /about/'}</code></pre>
            <p>Use TSX when you need custom static structure.</p>
          </article>
          <article className="home-page__example-card">
            <header>
              <span>04 / CONTENT</span>
              <h3>Add Markdown and layouts</h3>
            </header>
            <pre><code>{'---\ntitle: Notes\nlayout: docs\n---\n\n# Notes'}</code></pre>
            <p>Use Markdown for content and layouts for shared framing.</p>
          </article>
          <article className="home-page__example-card">
            <header>
              <span>05 / DATA</span>
              <h3>Build typed collections</h3>
            </header>
            <pre><code>{'defineCollection({\n  loader: glob({\n    base: \'src/content/posts\',\n    pattern: \'**/*.yaml\',\n    load: parseYaml,\n  }),\n  schema: postSchema,\n})'}</code></pre>
            <p>Load build-time data for indexes and related lists.</p>
          </article>
          <article className="home-page__example-card">
            <header>
              <span>06 / INTERACTION</span>
              <h3>Add one React island</h3>
            </header>
            <pre><code>{'// src/islands/counter.tsx\nexport default defineIsland(\n  \'counter\',\n  Counter,\n)\n\n<Counter\n  initialCount={0}\n  hydrate="load"\n/>'}</code></pre>
            <p>Only the interactive subtree gets browser JavaScript.</p>
          </article>
          <article className="home-page__example-card home-page__example-card--ship">
            <header>
              <span>07 / SHIP</span>
              <h3>Build static output</h3>
            </header>
            <pre><code>{'npm run build\nnpm run preview\n\n→ dist/client is ready to deploy'}</code></pre>
            <p>Prerender the site, preview the result, and deploy the generated HTML.</p>
          </article>
        </div>
      </section>
    </section>
  )
}
