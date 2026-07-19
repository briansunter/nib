import { siteHref, type PageMeta } from '@briansunter/nib'

export const meta: PageMeta = {
  title: 'Home',
  description: 'A static-site framework for React, Markdown, data pages, and opt-in islands.'
}

const authoringModes = [
  {
    file: 'page.tsx',
    title: 'React pages',
    description: 'Write custom page structure in TSX. Nib renders it to complete HTML.',
    output: 'HTML',
    href: '/docs/pages-and-routes/',
  },
  {
    file: 'page.md',
    title: 'Markdown',
    description: 'Put content in Markdown and wrap it with a shared layout.',
    output: 'HTML',
    href: '/docs/markdown-and-layouts/',
  },
  {
    file: 'page.csv',
    title: 'Data pages',
    description: 'Turn typed data into one route or an entire collection of pages.',
    output: 'many routes',
    href: '/docs/data-pages-and-collections/',
  },
  {
    file: 'islands/*.tsx',
    title: 'React islands',
    description: 'Add state and events to one subtree without hydrating the whole page.',
    output: 'opt-in JS',
    href: '/docs/react-islands/',
  },
] as const

export default function HomePage() {
  return (
    <section className="home-page">
      <div className="home-page__hero">
        <div className="home-page__hero-copy">
          <p className="home-page__eyebrow">
            <span className="home-page__eyebrow-dot" aria-hidden="true" />
            Static-site framework for React
          </p>
          <h1>React pages.<br /><em>Static output.</em></h1>
          <p className="home-page__lede">
            Nib turns React, Markdown, and data into complete static pages.
            Add browser JavaScript only where interaction needs it.
          </p>
          <div className="home-page__actions">
            <a className="button button--primary" href={siteHref('/docs/getting-started/')}>
              Get started <span aria-hidden="true">→</span>
            </a>
            <a className="button button--quiet" href={siteHref('/docs/')}>
              Read the docs
            </a>
          </div>
          <div className="home-page__command" aria-label="Create a new Nib site">
            <span aria-hidden="true">$</span>
            <code>npx @briansunter/nib init my-site</code>
          </div>
        </div>

        <aside className="home-page__route-sheet" aria-label="How Nib turns a route into HTML">
          <div className="home-page__route-sheet-head">
            <span>route / notes</span>
            <span>static by default</span>
          </div>
          <div className="home-page__source-file">
            <div className="home-page__file-tab">
              <span aria-hidden="true">◆</span>
              <code>src/pages/notes/page.md</code>
            </div>
            <pre><code>{'---\ntitle: Field notes\nlayout: docs\n---\n\n# Written clearly.\nPublished simply.'}</code></pre>
          </div>
          <div className="home-page__build-line" aria-hidden="true">
            <span>Nib builds</span>
          </div>
          <div className="home-page__output-file">
            <span className="home-page__output-mark" aria-hidden="true">
              <img src={siteHref('/nib-mark.svg')} alt="" />
            </span>
            <div>
              <span>output</span>
              <strong>/notes/index.html</strong>
              <small>Complete HTML · no client runtime</small>
            </div>
          </div>
        </aside>
      </div>

      <section className="home-page__structure" aria-labelledby="home-structure-title">
        <div className="home-page__structure-intro">
          <p className="home-page__eyebrow">Start with the file tree</p>
          <h2 id="home-structure-title">The source is the map.</h2>
          <p>
            Initialize a site, then let folders describe its routes. Keep content,
            typed data, and browser behavior in the places they belong.
          </p>
        </div>
        <div className="home-page__tree-card">
          <div className="home-page__tree-head">
            <span>my-site / src</span>
            <span>project map</span>
          </div>
          <pre aria-label="Example Nib project structure"><code>{'my-site/\n├── nib.config.ts\n└── src/\n    ├── pages/\n    │   ├── page.tsx\n    │   ├── about/page.md\n    │   ├── posts/page.csv\n    │   └── layout.tsx\n    ├── content/posts/\n    └── islands/counter.tsx'}</code></pre>
          <div className="home-page__tree-routes">
            <code>about/page.md → /about/</code>
            <code>counter.tsx → browser JS</code>
          </div>
        </div>
      </section>

      <section className="home-page__modes" aria-labelledby="home-modes-title">
        <div className="home-page__modes-intro">
          <p className="home-page__eyebrow">One site, four ways to author</p>
          <h2 id="home-modes-title">Use the lightest tool for each page.</h2>
          <p>
            Routes follow the file tree. Pick TSX, Markdown, or data at build time,
            then add an island when a small part needs to run in the browser.
          </p>
        </div>
        <div className="home-page__mode-list">
          {authoringModes.map((mode) => (
            <a className="home-page__mode" href={siteHref(mode.href)} key={mode.file}>
              <code>{mode.file}</code>
              <div>
                <strong>{mode.title}</strong>
                <span>{mode.description}</span>
              </div>
              <span className="home-page__mode-output">
                {mode.output} <span aria-hidden="true">↗</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="home-page__closing" aria-labelledby="home-closing-title">
        <div>
          <p className="home-page__eyebrow">From folder to host</p>
          <h2 id="home-closing-title">No server required.</h2>
        </div>
        <p>
          Build to <code>dist/client</code>, preview the result, and deploy it to any static host.
        </p>
        <a href={siteHref('/docs/github-pages/')}>
          Deploy a Nib site <span aria-hidden="true">→</span>
        </a>
      </section>
    </section>
  )
}
