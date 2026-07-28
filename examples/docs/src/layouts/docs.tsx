import { siteHref, type PageLayoutProps } from '@briansunter/nib'
import { documentation, type DocumentationLink } from '../docs-navigation'

function routePath(href: string): string {
  const withoutTrailingSlash = href.replace(/\/+$/, '')
  return withoutTrailingSlash || '/'
}

export default function DocsLayout({ children, route }: Pick<PageLayoutProps, 'children' | 'route'>) {
  const guides = documentation.flatMap<DocumentationLink>((section) => section.links)
  const currentIndex = guides.findIndex((item) => routePath(item.href) === routePath(route.path))
  const previous = currentIndex > 0 ? guides[currentIndex - 1] : undefined
  const next = currentIndex >= 0 && currentIndex < guides.length - 1 ? guides[currentIndex + 1] : undefined
  const isOverview = routePath(route.path) === '/docs'

  return (
    <div className="docs-layout">
      <aside className="docs-sidebar">
        <details className="docs-menu">
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
      <div className={`docs-article${isOverview ? ' docs-article--overview' : ''}`}>
        <div className="docs-article__topline">
          <a href={siteHref('/docs/')}>Documentation</a>
          <span aria-hidden="true">/</span>
          <span>Framework guide</span>
        </div>
        {children}
        {(previous || next) && (
          <nav aria-label="Guide pagination" className="docs-pagination">
            {previous ? (
              <a className="docs-pagination__link docs-pagination__link--previous" href={siteHref(previous.href)}>
                <span className="docs-pagination__direction">← Previous</span>
                <strong>{previous.label}</strong>
              </a>
            ) : <span />}
            {next ? (
              <a className="docs-pagination__link docs-pagination__link--next" href={siteHref(next.href)}>
                <span className="docs-pagination__direction">Next →</span>
                <strong>{next.label}</strong>
              </a>
            ) : <span />}
          </nav>
        )}
      </div>
    </div>
  )
}
