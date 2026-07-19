import { siteHref, type SiteShellProps } from '@briansunter/nib'

function routePath(href: string): string {
  return href.replace(/\/+$/, '') || '/'
}

export function SiteShell({ children, route, site }: SiteShellProps) {
  const navigation = site.navigation?.map((item) => ({
    ...item,
    active: routePath(item.href) === route.path,
  })) ?? []

  return (
    <div className="site">
      <header>
        <details className="mobile-nav">
          <summary className="mobile-nav__trigger" aria-label="Open navigation">
            <span aria-hidden="true">☰</span>
          </summary>
          <div className="mobile-nav__drawer">
            <span className="mobile-nav__eyebrow">Navigate</span>
            <span className="mobile-nav__title">{site.title}</span>
            <nav aria-label="Mobile primary">
              {navigation.map((item) => (
                <a aria-current={item.active ? 'page' : undefined} href={siteHref(item.href)} key={item.href}>
                  {item.label}
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </nav>
          </div>
        </details>
        <a href={siteHref('/')}>{site.title}</a>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <a aria-current={item.active ? 'page' : undefined} href={siteHref(item.href)} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>
      <main>{children}</main>
      <footer>Static by default. Interactive where it matters.</footer>
    </div>
  )
}
