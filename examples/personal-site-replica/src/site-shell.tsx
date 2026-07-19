import { siteHref, type SiteShellProps } from '@briansunter/nib'

function routePath(href: string) {
  return href.replace(/\/+$/, '') || '/'
}

export function SiteShell({ children, route, site }: SiteShellProps) {
  const currentPath = routePath(route.path)
  const navigation = site.navigation ?? []

  return (
    <div className="site-frame">
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="site-header">
        <div className="site-header__inner">
          <a className="site-brand" href={siteHref('/')}>
            <span className="brand-mark" aria-hidden="true">BS</span>
            <span>{site.title}</span>
          </a>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {navigation.map((item) => {
              const active = routePath(item.href) === currentPath
              return (
                <a href={siteHref(item.href)} aria-current={active ? 'page' : undefined} key={item.href}>
                  {item.label}
                </a>
              )
            })}
          </nav>
          <details className="mobile-nav">
            <summary aria-label="Open navigation">Menu</summary>
            <nav aria-label="Mobile navigation">
              {navigation.map((item) => <a href={siteHref(item.href)} key={item.href}>{item.label}</a>)}
            </nav>
          </details>
        </div>
      </header>
      <main id="content" className="site-main">{children}</main>
      <footer className="site-footer">
        <div>
          <span className="brand-mark" aria-hidden="true">BS</span>
          <p>Technology, productivity, and creativity.</p>
        </div>
        <div>
          <p className="eyebrow">Elsewhere</p>
          <p className="footer-links">
            <a href="https://github.com/briansunter">GitHub</a>
            <a href="https://x.com/briansunter">X</a>
            <a href={siteHref('/rss.xml')}>RSS</a>
          </p>
        </div>
        <p className="footer-note">A focused Nib proof, {new Date().getFullYear()}.</p>
      </footer>
    </div>
  )
}
