import { siteHref, type SiteShellProps } from '@briansunter/nib'
import { documentation } from './docs-navigation'

function routePath(href: string): string {
  const withoutTrailingSlash = href.replace(/\/+$/, '')
  return withoutTrailingSlash || '/'
}

export function SiteShell({ children, route, site }: SiteShellProps) {
  const currentPath = routePath(route.path)
  const isDocsRoute = currentPath === '/docs' || currentPath.startsWith('/docs/')

  const navigation = site.navigation?.map((item) => {
    const itemPath = routePath(item.href)
    const active = itemPath === currentPath || (itemPath === '/docs' && isDocsRoute)
    return { ...item, active }
  }) ?? []

  return (
    <div className="site-frame">
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="site-header">
        <div className="site-header__inner">
          <details className="mobile-nav">
            <summary className="mobile-nav__trigger" aria-label="Open navigation">
              <span className="mobile-nav__bars" aria-hidden="true" />
              <span className="sr-only">Menu</span>
            </summary>
            <div className="mobile-nav__drawer">
              <div className="mobile-nav__heading">
                <span className="mobile-nav__eyebrow">Navigate</span>
                <span className="mobile-nav__title">Nib</span>
              </div>
              <nav aria-label="Mobile primary" className="mobile-nav__links">
                {navigation.map((item) => (
                  <a
                    aria-current={item.active ? 'page' : undefined}
                    href={siteHref(item.href)}
                    key={item.href}
                  >
                    {item.label}
                    <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </nav>
              <nav aria-label="Mobile documentation" className="mobile-nav__documentation">
                <p className="mobile-nav__documentation-title">Documentation</p>
                {documentation.map((section) => (
                  <section className="mobile-nav__documentation-section" key={section.label}>
                    <h2 className="mobile-nav__documentation-label">{section.label}</h2>
                    <ul className="mobile-nav__documentation-list">
                      {section.links.map((item) => (
                        <li key={item.href}>
                          <a
                            aria-current={routePath(item.href) === currentPath ? 'page' : undefined}
                            href={siteHref(item.href)}
                          >
                            {item.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </nav>
              <p className="mobile-nav__note">Static by default. Interactive by choice.</p>
            </div>
          </details>
          <a className="site-brand" href={siteHref('/')} aria-label={`${site.title} home`}>
            <span className="site-brand__mark" aria-hidden="true">
              <img src={siteHref('/nib-mark.svg')} alt="" />
            </span>
            <span className="site-brand__words">
              <span className="site-brand__name">{site.title}</span>
              <span className="site-brand__tagline">static sites, carefully composed</span>
            </span>
          </a>
          <nav aria-label="Primary" className="site-primary-nav">
            {navigation.map((item) => {
              return (
                <a
                  aria-current={item.active ? 'page' : undefined}
                  href={siteHref(item.href)}
                  key={item.href}
                >
                  {item.label}
                </a>
              )
            })}
          </nav>
        </div>
      </header>
      <main className={`site-main${isDocsRoute ? ' site-main--docs' : ''}`} id="content">{children}</main>
      <footer className="site-footer">
        <span>React, Markdown, and data pages, static by default.</span>
        <a href={siteHref('/docs/')}>Read the docs <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  )
}
