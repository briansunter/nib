import { siteHref, type SiteShellProps } from '@briansunter/nib'

function routePath(href: string): string {
  return href.replace(/\/+$/, '') || '/'
}

export function SiteShell({ children, route, site }: SiteShellProps) {
  return (
    <div className="site">
      <header>
        <a href={siteHref('/')}>{site.title}</a>
        <nav aria-label="Main navigation">
          {site.navigation?.map((item) => (
            <a aria-current={routePath(item.href) === route.path ? 'page' : undefined} href={siteHref(item.href)} key={item.href}>
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
