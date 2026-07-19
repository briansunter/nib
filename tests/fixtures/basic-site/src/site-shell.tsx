import type { SiteShellProps } from '@briansunter/nib'

export function SiteShell({ children, site }: SiteShellProps) {
  return <main data-site={site.title}>{children}</main>
}
