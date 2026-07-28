import { siteHref, type SiteShellProps } from '@briansunter/nib'
import { ThemeToggle } from './components/theme-toggle'

function normalizedPath(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/, '')
}

export function SiteShell({ children, route, site }: SiteShellProps) {
  return (
    <div className="site-frame">
      <header className="site-header">
        <a className="wordmark" href={siteHref('/')}>
          <span aria-hidden="true">✦</span>
          {site.title}
        </a>
        <nav aria-label="Primary navigation">
          {site.navigation?.map((item) => (
            <a
              aria-current={
                normalizedPath(route.path) === normalizedPath(item.href)
                  ? 'page'
                  : undefined
              }
              href={siteHref(item.href)}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <ThemeToggle />
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <p>Commonplace is fictional sample content for the Nib blog template.</p>
        <div>
          <a href={siteHref('/rss.xml')}>RSS</a>
          <a href={siteHref('/sitemap.xml')}>Sitemap</a>
          <a href={siteHref('/search.json')}>Search data</a>
        </div>
      </footer>
    </div>
  )
}
