import { siteHref, type SiteShellProps } from '@briansunter/nib'

function routePath(href: string): string {
  const withoutTrailingSlash = href.replace(/\/+$/, '')
  return withoutTrailingSlash || '/'
}

export function SiteShell({ children, route, site }: SiteShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <a className="font-semibold tracking-tight" href={siteHref('/')}>{site.title}</a>
          <div className="flex gap-5 text-sm text-slate-300">
            {site.navigation?.map((item) => (
              <a
                className={routePath(item.href) === route.path ? 'text-white' : 'transition hover:text-white'}
                href={siteHref(item.href)}
                key={item.href}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-20">{children}</main>
      <footer className="mx-auto max-w-5xl border-t border-white/10 px-6 py-8 text-sm text-slate-400">
        React and Markdown, static by default.
      </footer>
    </div>
  )
}
