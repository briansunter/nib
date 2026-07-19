import { siteHref, type PageLayoutProps } from '@briansunter/nib'

const documentation = [
  {
    label: 'START HERE',
    links: [
      { label: 'Overview', href: '/docs/', description: 'What Nib is' },
      { label: 'Getting started', href: '/docs/getting-started/', description: 'Scaffold a site' },
    ],
  },
  {
    label: 'BUILD',
    links: [
      { label: 'Pages and routes', href: '/docs/pages-and-routes/', description: 'Turn files into URLs' },
      { label: 'Markdown and layouts', href: '/docs/markdown-and-layouts/', description: 'Write content in context' },
      { label: 'Data and collections', href: '/docs/data-pages-and-collections/', description: 'Generate typed pages and lists' },
      { label: 'React islands', href: '/docs/react-islands/', description: 'Add interaction selectively' },
    ],
  },
  {
    label: 'SHIP',
    links: [
      { label: 'GitHub Pages', href: '/docs/github-pages/', description: 'Deploy static output' },
      { label: 'Releases', href: '/docs/releases/', description: 'Version and publish Nib' },
    ],
  },
]

function routePath(href: string): string {
  const withoutTrailingSlash = href.replace(/\/+$/, '')
  return withoutTrailingSlash || '/'
}

export default function DocsLayout({ children, route }: Pick<PageLayoutProps, 'children' | 'route'>) {
  return (
    <div className="docs-layout">
      <aside className="docs-sidebar">
        <details className="docs-menu" open>
          <summary className="docs-menu__summary">
            <span>
              <span className="docs-menu__eyebrow">Nib manual</span>
              <span className="docs-menu__title">Documentation</span>
            </span>
            <span className="docs-menu__toggle" aria-hidden="true" />
          </summary>
          <nav aria-label="Documentation" className="docs-menu__nav">
            {documentation.map((section) => (
              <section className="docs-menu__section" key={section.label}>
                <h2 className="docs-menu__section-label">{section.label}</h2>
                <ul className="docs-menu__list">
                  {section.links.map((item) => (
                    <li key={item.href}>
                      <a
                        aria-current={routePath(item.href) === routePath(route.path) ? 'page' : undefined}
                        className="docs-menu__link"
                        href={siteHref(item.href)}
                      >
                        <span>{item.label}</span>
                        <span className="docs-menu__description">{item.description}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
          <div className="docs-menu__footer">
            <span className="docs-menu__status" aria-hidden="true" />
            <span>Static by default. Interactive by choice.</span>
          </div>
        </details>
      </aside>
      <div className="docs-article">
        <div className="docs-article__topline">
          <a href={siteHref('/docs/')}>Documentation</a>
          <span aria-hidden="true">/</span>
          <span>Framework guide</span>
        </div>
        {children}
      </div>
    </div>
  )
}
