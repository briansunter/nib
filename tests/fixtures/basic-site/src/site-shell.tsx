import type { SiteShellProps } from '@briansunter/nib'

export function SiteShell({ children }: SiteShellProps) {
  return <main data-site="Journal">{children}</main>
}
