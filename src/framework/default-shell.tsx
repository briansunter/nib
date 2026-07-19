import type { SiteShellProps } from './types'
import { siteHref } from './urls'

export function DefaultSiteShell({ children, site }: SiteShellProps) {
  return (
    <>
      <header>
        <a href={siteHref('/')}>{site.title}</a>
      </header>
      <main>{children}</main>
    </>
  )
}
