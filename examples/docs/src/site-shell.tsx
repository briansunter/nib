import { siteHref, type SiteShellProps } from '@briansunter/nib'

function routePath(href: string): string {
  const withoutTrailingSlash = href.replace(/\/+$/, '')
  return withoutTrailingSlash || '/'
}

export function SiteShell({ children, route, site }: SiteShellProps) {
  const isDocsRoute = route.path === '/docs' || route.path.startsWith('/docs/')

  return (
    <div className="site-frame">
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="site-header">
        <div className="site-header__inner">
          <a className="site-brand" href={siteHref('/')} aria-label={`${site.title} home`}>
            <span className="site-brand__mark" aria-hidden="true">n</span>
            <span className="site-brand__words">
              <span className="site-brand__name">{site.title}</span>
              <span className="site-brand__tagline">static sites, carefully composed</span>
            </span>
          </a>
          <nav aria-label="Primary" className="site-primary-nav">
            {site.navigation?.map((item) => {
              const itemPath = routePath(item.href)
              const active = itemPath === route.path || (itemPath === '/docs' && isDocsRoute)
              return (
                <a
                  aria-current={active ? 'page' : undefined}
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
        React and Markdown, static by default.
      </footer>
    </div>
  )
}
