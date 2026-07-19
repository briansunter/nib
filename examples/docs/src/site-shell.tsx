import { siteHref, type SiteShellProps } from '@briansunter/nib'

function routePath(href: string): string {
  const withoutTrailingSlash = href.replace(/\/+$/, '')
  return withoutTrailingSlash || '/'
}

export function SiteShell({ children, route, site }: SiteShellProps) {
  const isDocsRoute = route.path === '/docs' || route.path.startsWith('/docs/')

  const navigation = site.navigation?.map((item) => {
    const itemPath = routePath(item.href)
    const active = itemPath === route.path || (itemPath === '/docs' && isDocsRoute)
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
              <p className="mobile-nav__note">Static by default. Interactive by choice.</p>
            </div>
          </details>
          <a className="site-brand" href={siteHref('/')} aria-label={`${site.title} home`}>
            <span className="site-brand__mark" aria-hidden="true">n</span>
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
        React, Markdown, and data pages, static by default.
      </footer>
    </div>
  )
}
